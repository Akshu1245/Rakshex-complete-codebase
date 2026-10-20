import { resolveBackendOrigin } from './backend-proxy';

describe('Cloudflare production backend origin validation', () => {
  const incoming = 'https://rakshex-preview.workers.dev/api/dashboard';

  it('allows only a separate public HTTPS origin', () => {
    expect(resolveBackendOrigin('https://api.example.com', incoming, true)?.origin).toBe('https://api.example.com');
    expect(resolveBackendOrigin('https://api.example.com', incoming, true)?.pathname).toBe('/');
  });

  it.each([
    'http://api.example.com', 'http://127.0.0.1:8000',
    'https://localhost:8000', 'https://admin.local',
    'https://api.localhost', 'https://127.0.0.1',
    'https://169.254.169.254', 'https://10.10.0.4',
    'https://user:pass@api.example.com',
    'https://api.example.com/hidden',
    'https://api.example.com?token=secret',
    'https://rakshex-preview.workers.dev',
    'garbled',
  ])('rejects insecure or unsafe production backend %s', (backend) => {
    expect(resolveBackendOrigin(backend, incoming, true)).toBeNull();
  });

  it('preserves explicit localhost only in local development', () => {
    expect(resolveBackendOrigin('http://127.0.0.1:8000', incoming, false)?.port).toBe('8000');
    expect(resolveBackendOrigin('http://127.0.0.1:8000', incoming, true)).toBeNull();
  });
});
