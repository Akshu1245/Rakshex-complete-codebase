import robots from '../src/app/robots';

describe('application search-engine boundaries', () => {
  it('disallows crawling operational dashboard routes', () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: '*', disallow: '/' }],
    });
  });
});
