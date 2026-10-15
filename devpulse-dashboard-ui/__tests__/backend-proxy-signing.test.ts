/** @jest-environment node */
import { signedClientIpHeaders } from '@/lib/backend-proxy';

describe('signed client IP header (must match backend middleware/rate_limit.sign_client_ip)', () => {
  const realNow = Date.now;
  afterEach(() => { Date.now = realNow; delete process.env.PROXY_SIGNING_SECRET; });

  it('produces the same HMAC as the Python backend', async () => {
    process.env.PROXY_SIGNING_SECRET = 'test-secret';
    Date.now = () => 1700000000 * 1000;
    const h = await signedClientIpHeaders(new Request('http://x/api', { headers: { 'cf-connecting-ip': '198.51.100.20' } }));
    expect(h).toEqual({ 'x-rakshex-client-ip': '198.51.100.20', 'x-rakshex-client-ts': '1700000000', 'x-rakshex-client-sig': '0ba8f7f4cd8a0bd9fc0420a4477232206b5c45480607b626a4c37cfa5d343e96' });
  });

  it('adds nothing without a secret', async () => {
    const h = await signedClientIpHeaders(new Request('http://x/api', { headers: { 'cf-connecting-ip': '1.2.3.4' } }));
    expect(h).toEqual({});
  });
});
