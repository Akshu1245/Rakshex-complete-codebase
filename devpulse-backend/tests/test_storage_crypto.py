import base64
import pytest
from services import storage_crypto


@pytest.mark.asyncio
async def test_versioned_encryption_roundtrip_and_random_nonces(monkeypatch):
    monkeypatch.setattr(storage_crypto, '_get_master_key', lambda: bytes(range(32)))
    one = await storage_crypto.encrypt_for_storage('unicode-key-✓')
    two = await storage_crypto.encrypt_for_storage('unicode-key-✓')
    assert one.startswith('v2:') and two.startswith('v2:') and one != two
    assert await storage_crypto.decrypt_from_storage(one) == 'unicode-key-✓'
    assert await storage_crypto.decrypt_from_storage(two) == 'unicode-key-✓'


@pytest.mark.asyncio
async def test_modified_ciphertext_and_wrong_master_are_rejected(monkeypatch):
    monkeypatch.setattr(storage_crypto, '_get_master_key', lambda: b'a' * 32)
    encrypted = await storage_crypto.encrypt_for_storage('secret-key')
    raw = bytearray(base64.b64decode(encrypted[3:]))
    raw[-1] ^= 1
    with pytest.raises(ValueError):
        await storage_crypto.decrypt_from_storage('v2:' + base64.b64encode(raw).decode())
    monkeypatch.setattr(storage_crypto, '_get_master_key', lambda: b'b' * 32)
    with pytest.raises(ValueError):
        await storage_crypto.decrypt_from_storage(encrypted)


@pytest.mark.asyncio
async def test_existing_records_are_read_through_the_legacy_decoder(monkeypatch):
    monkeypatch.setattr(storage_crypto, 'decrypt_aes256', lambda value: 'legacy plaintext')
    assert await storage_crypto.decrypt_from_storage('existing-record') == 'legacy plaintext'
