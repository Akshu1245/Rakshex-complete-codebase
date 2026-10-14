"""Keep bcrypt cost unchanged; run it in PostgreSQL for CPU-limited Workers."""
import os
from sqlalchemy import text


async def hash_password(password: str) -> str:
    if os.getenv('WORKERS_RUNTIME') == 'true':
        from services.db_config import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT crypt(:password, gen_salt('bf', 12))"), {'password': password})
            return result.scalar_one()
    import bcrypt
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


async def verify_password(password: str, password_hash: str) -> bool:
    if os.getenv('WORKERS_RUNTIME') == 'true':
        from services.db_config import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            result = await session.execute(text('SELECT crypt(:password, :hash) = :hash'), {'password': password, 'hash': password_hash})
            return bool(result.scalar_one())
    import bcrypt
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))
