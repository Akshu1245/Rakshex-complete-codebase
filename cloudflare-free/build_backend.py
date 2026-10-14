"""Stage only application files; never copy .env, databases, tests or credentials."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
build = ROOT / 'cloudflare-free' / 'backend' / 'build'
source = build / 'src'
source.mkdir(parents=True, exist_ok=True)
backend = ROOT / 'devpulse-backend'
for folder in ('models', 'routes', 'services', 'middleware'):
    destination = source / folder
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(backend / folder, destination, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
shutil.copy2(backend / 'main.py', source / 'main.py')
shutil.copy2(ROOT / 'cloudflare-free' / 'backend' / 'entry.py', source / 'entry.py')
shutil.copy2(ROOT / 'cloudflare-free' / 'backend' / 'pyproject.toml', build / 'pyproject.toml')
shutil.copy2(ROOT / 'cloudflare-free' / 'backend' / 'pylock.toml', build / 'pylock.toml')
shutil.copy2(ROOT / 'cloudflare-free' / 'backend' / 'wrangler.jsonc', build / 'wrangler.jsonc')
print(f'Staged backend at {build}')
