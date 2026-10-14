import asyncio
import pytest
import jwt
from sqlalchemy import text
from services.workers_database import build_database
from services.runtime_context import runtime_secrets
from routes.auth import create_token, verify_token


@pytest.mark.asyncio
async def test_facade_preserves_commit_and_transaction_rollback():
    engine, sessions = build_database('sqlite://')
    async with engine.begin() as connection:
        await connection.execute(text('CREATE TABLE entries(id INTEGER PRIMARY KEY, value TEXT)'))
    async with sessions() as session:
        async with session.begin():
            await session.execute(text("INSERT INTO entries VALUES(1,'committed')"))
    with pytest.raises(ValueError):
        async with sessions() as session:
            async with session.begin():
                await session.execute(text("INSERT INTO entries VALUES(2,'rolled back')"))
                raise ValueError('rollback this transaction')
    async with sessions() as session:
        rows = (await session.execute(text('SELECT value FROM entries ORDER BY id'))).scalars().all()
        assert rows == ['committed']
    await engine.dispose()


def test_worker_auth_has_no_global_secret_fallback(monkeypatch):
    monkeypatch.setenv('WORKERS_RUNTIME', 'true')
    token = runtime_secrets.set(None)
    try:
        with pytest.raises(RuntimeError):
            create_token(1, 'test@example.com')
    finally:
        runtime_secrets.reset(token)


@pytest.mark.asyncio
async def test_worker_signing_secrets_are_isolated_between_concurrent_requests(monkeypatch):
    monkeypatch.setenv('WORKERS_RUNTIME', 'true')

    async def request(user_id, secret):
        token = runtime_secrets.set({'JWT_SECRET': secret})
        try:
            await asyncio.sleep(0)
            signed = create_token(user_id, f'{user_id}@example.com')
            assert verify_token(signed)['sub'] == str(user_id)
            assert jwt.decode(signed, secret, algorithms=['HS256'])['sub'] == str(user_id)
            with pytest.raises(jwt.InvalidSignatureError):
                jwt.decode(signed, 'different-secret-with-at-least-32-characters', algorithms=['HS256'])
        finally:
            runtime_secrets.reset(token)

    await asyncio.gather(request(1, 'one-' * 12), request(2, 'two-' * 12))
