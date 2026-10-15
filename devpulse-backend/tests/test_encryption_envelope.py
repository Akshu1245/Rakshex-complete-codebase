"""Synthetic standalone regression suite; pytest runs it in an isolated process."""
if __name__ != "__main__":
    import subprocess
    import sys

    def test_standalone_security_regressions():
        # Keep unittest's event-loop policy and synthetic environment out of the
        # existing pytest session-scoped database/event-loop fixtures.
        result = subprocess.run([sys.executable, "-B", __file__], capture_output=True, text=True, timeout=90)
        assert result.returncode == 0, result.stdout + result.stderr
else:
    """Synthetic-only: python tests/test_encryption_envelope.py. No production data."""
    import base64
    import hashlib
    import os
    import sys
    import unittest
    from pathlib import Path
    from unittest.mock import patch
    
    os.environ.update(DEVPULSE_ENCRYPTION_KEY=base64.b64encode(b"K" * 32).decode(), JWT_SECRET="synthetic-test-signing-key-not-for-deployment", ENV="test", DATABASE_URL="sqlite+aiosqlite:///:memory:", REDIS_URL="", WORKERS_RUNTIME="false")
    sys.path.insert(0, os.environ.get("RAKSHEX_TEST_SOURCE", str(Path(__file__).resolve().parents[1])))
    from services import encryption as enc
    try:
        from services import storage_crypto as storage
    except ImportError:
        storage = None  # Exercise the old writer when checking the unmodified baseline.
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    
    
    async def encrypt(value):
        return await storage.encrypt_for_storage(value) if storage else enc.encrypt_aes256(value)
    
    
    async def decrypt(value):
        return await storage.decrypt_from_storage(value) if storage else enc.decrypt_aes256(value)
    
    
    class EncryptionEnvelopeTests(unittest.IsolatedAsyncioTestCase):
        def setUp(self):
            enc._MASTER_KEY_ENV = base64.b64encode(b"K" * 32).decode()
    
        async def test_new_writes_use_existing_v2_standard_format(self):
            payload = "synthetic-only credential / \u2603"
            encrypted = await encrypt(payload)
            self.assertTrue(encrypted.startswith("v2:"), "new writes must use the existing versioned codec")
            raw = base64.b64decode(encrypted[3:], validate=True)
            key = hashlib.sha256(b"K" * 32).digest()
            self.assertEqual(AESGCM(key).decrypt(raw[:12], raw[12:], b"devpulse-api-key:v2").decode(), payload)
            self.assertEqual(await decrypt(encrypted), payload)
    
        async def test_random_nonces(self):
            self.assertNotEqual(await encrypt("synthetic"), await encrypt("synthetic"))
    
        async def test_empty_roundtrip_and_legacy_empty_read(self):
            self.assertEqual(await decrypt(await encrypt("")), "")
            self.assertEqual(await decrypt(""), "")
    
        async def test_wrong_key_and_tampering_fail_closed(self):
            encrypted = await encrypt("synthetic")
            self.assertTrue(encrypted.startswith("v2:"))
            raw = bytearray(base64.b64decode(encrypted[3:]))
            for offset in (0, 12, len(raw) - 1):
                changed = raw.copy()
                changed[offset] ^= 1
                with self.assertRaises(ValueError):
                    await decrypt("v2:" + base64.b64encode(changed).decode())
            enc._MASTER_KEY_ENV = base64.b64encode(b"W" * 32).decode()
            with self.assertRaises(ValueError):
                await decrypt(encrypted)
    
        async def test_unknown_and_malformed_versions_fail_closed(self):
            for value in ("v3:AAAA", "v2:not base64!", "v2:AAAA"):
                with self.assertRaises(ValueError):
                    await decrypt(value)
    
        async def test_short_master_rejects_new_writes(self):
            enc._MASTER_KEY_ENV = base64.b64encode(b"K" * 24).decode()
            with self.assertRaises(ValueError):
                await encrypt("synthetic")
    
        async def test_legacy_read_and_candidate_upgrade_preserve_input(self):
            legacy = LEGACY_FIXTURE
            self.assertEqual(await decrypt(legacy), "synthetic-legacy-only")
            upgraded = await storage.upgrade_ciphertext(legacy)
            self.assertEqual(legacy, LEGACY_FIXTURE)
            self.assertTrue(upgraded.startswith("v2:"))
            self.assertEqual(await decrypt(upgraded), "synthetic-legacy-only")
            self.assertEqual(await storage.upgrade_ciphertext(upgraded), upgraded)
    
        async def test_api_key_create_persists_v2_in_isolated_sqlite(self):
            from services import database as db
            from routes.budget import create_api_key, AddApiKeyRequest
            from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
            from sqlalchemy import select
            from models.tables import Base, User, ApiKey
            engine = create_async_engine("sqlite+aiosqlite:///:memory:")
            sessions = async_sessionmaker(engine, expire_on_commit=False)
            try:
                async with engine.begin() as connection:
                    await connection.run_sync(Base.metadata.create_all)
                async with sessions() as session:
                    user = User(email="synthetic@invalid.test", username="synthetic", password_hash="test-only")
                    session.add(user)
                    await session.commit()
                    user_id = user.id
                with patch.object(db, "AsyncSessionLocal", sessions):
                    result = await create_api_key(AddApiKeyRequest(key_name="synthetic", api_provider="custom", api_key="synthetic-legacy-only"), {"id": user_id})
                self.assertEqual(result["status"], "success")
                async with sessions() as session:
                    key = (await session.execute(select(ApiKey))).scalar_one()
                    self.assertTrue(key.encrypted_key.startswith("v2:"))
                    self.assertEqual(await decrypt(key.encrypted_key), "synthetic-legacy-only")
            finally:
                await engine.dispose()
    
    
    LEGACY_FIXTURE = "9fGfZZafLVX+l4Ls9RKTeZ/Q2MNpRsVC9Is+O6Yje2aMnpTQIopZERdu6XlgEw7Hi4iSNA8bPvNYco+0+MxLjg3hivME3OYrfwL2YA1aYtMWX/F4RiT8AuPvjB7XKMW5gg=="
    if __name__ == "__main__":
        unittest.main()
