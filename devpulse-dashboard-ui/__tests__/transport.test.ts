/** @jest-environment node */
import { apiClient } from '../src/lib/api';
import { apiFetch, APIError } from '../src/lib/transport';
import { proxyBackend } from '../src/lib/backend-proxy';

describe('real request and proxy contracts', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = jest.fn(); process.env.BACKEND_URL = 'https://backend.example'; });
  afterEach(() => { global.fetch = originalFetch; delete process.env.BACKEND_URL; });

  it('rejects network failures instead of returning a successful security result', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new TypeError('network failed'));
    await expect(apiClient.fullSecurityScan('source')).rejects.toBeInstanceOf(APIError);
  });

  it('preserves validation errors returned by FastAPI', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(Response.json({detail: 'Invalid amount'}, {status: 422}));
    await expect(apiFetch('/api/test')).rejects.toMatchObject({status: 422, message: 'Invalid amount'});
  });

  it('sends cost token counts and forecast parameters accepted by the backend', async () => {
    (global.fetch as jest.Mock).mockImplementation(async () => Response.json({status: 'ok'}));
    await apiClient.calculateCost('gpt-4o', 123, 456);
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({provider: '', model: 'gpt-4o', tokens_input: 123, tokens_output: 456});
    await apiClient.getCostForecast(12);
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('days_ahead=12');
  });

  it('sends findings and required budget fields', async () => {
    (global.fetch as jest.Mock).mockImplementation(async () => Response.json({status: 'ok'}));
    await apiClient.getFixSuggestions('source', [{severity: 'high'}]);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toHaveProperty('findings');
    await apiClient.createCostBudget('openai', 20);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual({name: 'openai', provider: 'openai', monthly_limit_usd: 20, alert_threshold_pct: 80});
  });

  it('forwards the exact signed body and streams CSV with attachment headers', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response('id,score\n1,75', {headers: {'content-type': 'text/csv', 'content-disposition': 'attachment; filename=report.csv'}}));
    const body = '{"event":"signed bytes"}';
    const response = await proxyBackend(new Request('https://app.example/api/billing/webhook', {method: 'POST', body, headers: {authorization: 'Bearer session', 'stripe-signature': 'signature', 'content-type': 'application/json'}}));
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url.href).toBe('https://backend.example/api/billing/webhook');
    expect(options.headers.get('authorization')).toBe('Bearer session');
    expect(options.headers.get('stripe-signature')).toBe('signature');
    expect(new TextDecoder().decode(options.body)).toBe(body);
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('content-disposition')).toContain('report.csv');
    expect(await response.text()).toBe('id,score\n1,75');
  });

  it('returns a non-cacheable 503 when the upstream is unavailable', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const response = await proxyBackend(new Request('https://app.example/api/auth/me'));
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
