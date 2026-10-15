/** @jest-environment node */
import { signedClientIpHeaders, platformClientIp, proxyBackend } from '@/lib/backend-proxy';

const req = (h: Record<string, string>) => new Request('http://dash.example/api/x', { headers: h });

describe('signed client IP header (must match backend middleware/rate_limit.sign_client_ip)', () => {
  const realNow = Date.now;
  afterEach(() => { Date.now = realNow; delete process.env.PROXY_SIGNING_SECRET; delete process.env.CLIENT_IP_SOURCE; });

  it('produces the same HMAC as the Python backend', async () => {
    process.env.PROXY_SIGNING_SECRET = 'test-secret'; process.env.CLIENT_IP_SOURCE = 'cloudflare';
    Date.now = () => 1700000000 * 1000;
    const h = await signedClientIpHeaders(req({ 'cf-connecting-ip': '198.51.100.20' }));
    expect(h).toEqual({ 'x-rakshex-client-ip': '198.51.100.20', 'x-rakshex-client-ts': '1700000000', 'x-rakshex-client-sig': '0ba8f7f4cd8a0bd9fc0420a4477232206b5c45480607b626a4c37cfa5d343e96' });
  });

  it('adds nothing without a secret', async () => {
    process.env.CLIENT_IP_SOURCE = 'cloudflare';
    expect(await signedClientIpHeaders(req({ 'cf-connecting-ip': '1.2.3.4' }))).toEqual({});
  });

  it('signs nothing when the platform is not configured (all forwarded headers spoofable)', async () => {
    process.env.PROXY_SIGNING_SECRET = 's';
    expect(await signedClientIpHeaders(req({ 'cf-connecting-ip': '1.2.3.4', 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '1.2.3.4' }))).toEqual({});
  });
});

describe('spoofed forwarded headers per platform', () => {
  // Cloudflare: edge overwrites CF-Connecting-IP and strips X-Real-IP; XFF is APPENDED (left-most = attacker's value).
  it('cloudflare: uses only CF-Connecting-IP, ignores client X-Real-IP / XFF', () => {
    expect(platformClientIp(req({ 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }), 'cloudflare')).toBe('203.0.113.7');
    expect(platformClientIp(req({ 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6' }), 'cloudflare')).toBeNull();
  });
  // Vercel: overwrites X-Forwarded-For, X-Real-IP, X-Vercel-Forwarded-For; does NOT strip CF-Connecting-IP.
  it('vercel: ignores attacker-supplied CF-Connecting-IP and XFF', () => {
    expect(platformClientIp(req({ 'cf-connecting-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6', 'x-vercel-forwarded-for': '203.0.113.8', 'x-real-ip': '203.0.113.8' }), 'vercel')).toBe('203.0.113.8');
    expect(platformClientIp(req({ 'cf-connecting-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6' }), 'vercel')).toBeNull();
  });
  it('rejects non-IP / list / injection values', () => {
    for (const v of ['6.6.6.6, 1.1.1.1', 'evil', '1.2.3.4\r\nx: y', '999.1.1.1', '01.2.3.4', '::1%eth0', '']) {
      expect(platformClientIp(req({ 'cf-connecting-ip': v.replace(/[\r\n]/g, '') }), 'cloudflare')).toBeNull();
    }
    expect(platformClientIp(req({ 'cf-connecting-ip': '2001:db8::1' }), 'cloudflare')).toBe('2001:db8::1');
  });
});

describe('proxyBackend end-to-end header hygiene', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; delete process.env.PROXY_SIGNING_SECRET; delete process.env.CLIENT_IP_SOURCE; delete process.env.BACKEND_URL; });
  it('client-forged x-rakshex-* and XFF never reach the backend; only the proxy-signed IP does', async () => {
    process.env.BACKEND_URL = 'http://127.0.0.1:9'; process.env.PROXY_SIGNING_SECRET = 's'; process.env.CLIENT_IP_SOURCE = 'vercel';
    let sent: Headers | undefined;
    global.fetch = jest.fn(async (_u: unknown, init?: RequestInit) => { sent = new Headers(init?.headers); return new Response('{}'); }) as typeof fetch;
    await proxyBackend(req({ 'x-rakshex-client-ip': '6.6.6.6', 'x-rakshex-client-ts': '1', 'x-rakshex-client-sig': 'f'.repeat(64),
      'x-forwarded-for': '6.6.6.6', 'cf-connecting-ip': '6.6.6.6', 'x-real-ip': '203.0.113.9' }));
    expect(sent?.get('x-rakshex-client-ip')).toBe('203.0.113.9');
    expect(sent?.get('x-rakshex-client-sig')).not.toBe('f'.repeat(64));
    expect(sent?.get('x-forwarded-for')).toBeNull();
    expect(sent?.get('cf-connecting-ip')).toBeNull();
  });
});
