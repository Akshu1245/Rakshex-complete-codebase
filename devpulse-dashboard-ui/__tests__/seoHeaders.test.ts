import nextConfig from '../next.config';

describe('internal dashboard SEO policy', () => {
  it('sets X-Robots-Tag on all frontend routes, including API proxies', async () => {
    const rules = await nextConfig.headers?.();
    const catchAll = rules?.find((rule) => rule.source === '/:path*');

    expect(catchAll).toBeDefined();
    expect(catchAll?.headers).toContainEqual({
      key: 'X-Robots-Tag',
      value: 'noindex, nofollow, noarchive',
    });
  });
});
