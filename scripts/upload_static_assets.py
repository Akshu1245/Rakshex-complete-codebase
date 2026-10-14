"""Upload static files with a Cloudflare-generated, scoped assets upload session.

Arguments: SESSION_JSON MANIFEST_JSON ASSET_DIRECTORY COMPLETION_JSON.
Session/completion files contain temporary deployment tokens; never commit them.
"""
import base64
import json
import mimetypes
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen
import uuid


def upload(session_path, manifest_path, asset_directory, completion_path):
    session = json.loads(Path(session_path).read_text())
    manifest = json.loads(Path(manifest_path).read_text())
    root = Path(asset_directory)
    by_hash = {entry['hash']: root / path.lstrip('/') for path, entry in manifest.items()}
    completion = session['jwt'] if not session['buckets'] else None
    for index, bucket in enumerate(session['buckets']):
        boundary = 'Asset' + uuid.uuid4().hex
        parts = []
        for name in bucket:
            path = by_hash[name]
            mime = mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
            header = f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'
            parts.append(header.encode() + base64.b64encode(path.read_bytes()) + b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())
        request = Request(
            'https://api.cloudflare.com/client/v4/accounts/b3225f198c6d2286afbb6f416c230f10/workers/assets/upload?base64=true',
            data=b''.join(parts), headers={
                'Authorization': 'Bearer ' + session['jwt'],
                'Content-Type': 'multipart/form-data; boundary=' + boundary,
                'User-Agent': 'Mozilla/5.0',
            },
        )
        with urlopen(request, timeout=45) as response:
            result = json.load(response)
        if not result['success']:
            raise RuntimeError('Static asset upload failed')
        completion = result.get('result', {}).get('jwt') or completion
        print(f'Uploaded bucket {index + 1}: {len(bucket)} files', flush=True)
    if not completion:
        raise RuntimeError('No asset completion token returned')
    path = Path(completion_path)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump({'jwt': completion}, output)


if __name__ == '__main__':
    upload(*sys.argv[1:])
