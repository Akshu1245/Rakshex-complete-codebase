"""Versioned AES-256-GCM for new API-key records across native and edge runtimes."""
import base64
import hashlib
import os
import secrets

from services.encryption import _get_master_key, decrypt_aes256

AAD = b'devpulse-api-key:v2'


async def _aes(operation, key, nonce, data):
    if os.getenv('WORKERS_RUNTIME') == 'true':
        from js import crypto, Uint8Array, Object
        from pyodide.ffi import to_js
        raw = Uint8Array.new(to_js(list(key)))
        imported = await crypto.subtle.importKey('raw', raw, 'AES-GCM', False, to_js([operation]))
        algorithm = to_js({'name': 'AES-GCM', 'iv': Uint8Array.new(to_js(list(nonce))),
                           'additionalData': Uint8Array.new(to_js(list(AAD))), 'tagLength': 128},
                          dict_converter=Object.fromEntries)
        output = await getattr(crypto.subtle, operation)(algorithm, imported, Uint8Array.new(to_js(list(data))))
        return bytes(Uint8Array.new(output).to_py())
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    return getattr(AESGCM(key), operation)(nonce, data, AAD)


async def encrypt_for_storage(plaintext):
    # The configured master is an existing random secret, not a user password.
    # Derive a fixed-length key and use a fresh nonce for every AEAD operation.
    master = _get_master_key()
    if len(master) != 32:
        raise ValueError('Master key must resolve to 32 bytes for new writes')
    key = hashlib.sha256(master).digest()
    nonce = secrets.token_bytes(12)
    ciphertext = await _aes('encrypt', key, nonce, plaintext.encode('utf-8'))
    return 'v2:' + base64.b64encode(nonce + ciphertext).decode('ascii')


async def decrypt_from_storage(encrypted):
    if ':' in encrypted and not encrypted.startswith('v2:'):
        raise ValueError('Unsupported ciphertext version')
    if not encrypted.startswith('v2:'):
        return decrypt_aes256(encrypted)  # Preserve existing records and the master key.
    try:
        value = base64.b64decode(encrypted[3:], validate=True)
        if len(value) < 28:
            raise ValueError('Invalid encrypted record')
        key = hashlib.sha256(_get_master_key()).digest()
        plaintext = await _aes('decrypt', key, value[:12], value[12:])
        return plaintext.decode('utf-8')
    except Exception as exc:
        raise ValueError('Invalid encrypted record') from exc


async def upgrade_ciphertext(encrypted):
    """Return a verified v2 candidate without writing or overwriting storage."""
    plaintext = await decrypt_from_storage(encrypted)
    return encrypted if encrypted.startswith('v2:') else await encrypt_for_storage(plaintext)
