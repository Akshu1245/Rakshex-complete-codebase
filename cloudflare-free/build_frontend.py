"""Build the existing UI as static assets; the edge gateway owns server routes."""
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
original = ROOT / 'devpulse-dashboard-ui'
build = ROOT / 'cloudflare-free' / 'frontend' / 'build'
build.mkdir(parents=True, exist_ok=True)
for folder in ('src', 'public'):
    destination = build / folder
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(original / folder, destination)
for name in ('api', 'backend-docs', 'connection-info', 'health', 'openapi.json'):
    shutil.rmtree(build / 'src' / 'app' / name)
for name in ('package.json', 'tsconfig.json', 'postcss.config.mjs', 'next-env.d.ts'):
    if (original / name).exists():
        shutil.copy2(original / name, build / name)
node_modules = build / 'node_modules'
if not node_modules.exists():
    node_modules.symlink_to(ROOT / 'node_modules', target_is_directory=True)
(build / 'next.config.ts').write_text("import type {NextConfig} from 'next';\nconst config: NextConfig = {output:'export',trailingSlash:true,images:{unoptimized:true}};\nexport default config;\n")
subprocess.run(['npm', 'run', 'build'], cwd=build, check=True)
print(f'Static frontend built at {build / "out"}')
