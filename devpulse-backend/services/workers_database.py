"""Awaitable facade over synchronous SQLAlchemy for Python Workers.

Cloudflare implements cooperative TCP sockets for pg8000, but does not ship
greenlet. Keep the established ORM statements and transaction boundaries while
avoiding SQLAlchemy's greenlet-based AsyncSession bridge. Each session owns its
connection; NullPool ensures request-scoped sockets never leak across requests.
"""
from contextlib import asynccontextmanager
import asyncio

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

_operation_lock = asyncio.Lock()


async def _serial(task, *args, **kwargs):
    # The Workers socket bridge can yield during a synchronous driver call.
    # Serialize driver operations without holding a lock around external APIs.
    async with _operation_lock:
        return task(*args, **kwargs)


class SessionFacade:
    def __init__(self, engine, **kwargs):
        self.session = Session(engine, expire_on_commit=False, **kwargs)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        await _serial(self.session.close)

    def add(self, value):
        self.session.add(value)

    async def execute(self, *args, **kwargs):
        return await _serial(self.session.execute, *args, **kwargs)

    async def get(self, *args, **kwargs):
        return await _serial(self.session.get, *args, **kwargs)

    async def commit(self):
        await _serial(self.session.commit)

    async def refresh(self, *args, **kwargs):
        await _serial(self.session.refresh, *args, **kwargs)

    async def rollback(self):
        await _serial(self.session.rollback)

    async def close(self):
        await _serial(self.session.close)

    @asynccontextmanager
    async def begin(self):
        transaction = self.session.begin()
        try:
            yield self
        except BaseException:
            await _serial(transaction.rollback)
            raise
        else:
            await _serial(transaction.commit)


class ConnectionFacade:
    def __init__(self, connection):
        self.connection = connection

    async def run_sync(self, task):
        return task(self.connection)

    async def execute(self, *args, **kwargs):
        return self.connection.execute(*args, **kwargs)


class EngineFacade:
    def __init__(self, engine):
        self.sync_engine = engine
        self.url = engine.url

    @asynccontextmanager
    async def begin(self):
        with self.sync_engine.begin() as connection:
            yield ConnectionFacade(connection)

    async def dispose(self):
        self.sync_engine.dispose()


def build_database(url, *, creator=None):
    options = {'creator': creator, 'poolclass': NullPool} if creator else {}
    engine = create_engine(url, **options)
    return EngineFacade(engine), lambda **kwargs: SessionFacade(engine, **kwargs)


def hyperdrive_connection():
    import pg8000.dbapi
    from workers import env
    hd = env.HYPERDRIVE
    return pg8000.dbapi.connect(
        host=hd.host, port=int(hd.port), user=hd.user,
        password=hd.password, database=hd.database, ssl_context=False,
        timeout=15,
    )
