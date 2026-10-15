import asyncio, os, sys, collections
sys.path.insert(0, os.getcwd())
import httpx
from routes.auth import create_token
fails = []
def check(c, m):
    print(("  PASS " if c else "  FAIL ") + m)
    if not c: fails.append(m)

async def burst(c, n, headers):
    urls = [f"http://127.0.0.1:{8101 + (i % 2)}/api/changes/providers" for i in range(n)]
    rs = await asyncio.gather(*[c.get(u, headers=headers) for u in urls])
    return collections.Counter(r.status_code for r in rs)

async def main():
    A = {"Authorization": f"Bearer {create_token(1, 'a@x.test')}"}
    B = {"Authorization": f"Bearer {create_token(2, 'b@x.test')}"}
    async with httpx.AsyncClient(timeout=30, limits=httpx.Limits(max_connections=40)) as c:
        a = await burst(c, 130, A)   # free tier = 100/hour, split across both instances, concurrent
        check(a[200] == 100 and a[429] == 30, f"user A: exactly 100 allowed across 2 instances, 30 x 429: {dict(a)}")
        b = await burst(c, 20, B)
        check(b[200] == 20, f"user B unaffected by A's exhaustion: {dict(b)}")
        n = await burst(c, 50, {})   # anon hourly = 40, same peer 127.0.0.1
        check(n[200] == 40 and n[429] == 10, f"anon IP: exactly 40 allowed across instances: {dict(n)}")
        b2 = await burst(c, 5, B)
        check(b2[200] == 5, f"user B unaffected by anon IP exhaustion: {dict(b2)}")
asyncio.run(main())
if fails: sys.exit(1)
