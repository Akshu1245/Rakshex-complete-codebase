import { apiClient } from '../src/lib/api';

const fakeResponse = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  status, ok: status < 400, headers: { get: (k: string) => headers[k] ?? null }, json: async () => body,
});

it('DashboardStats and HealthMonitor share one /api/dashboard request per refresh', async () => {
  const body = { status: 'success', summary: { total: 1, healthy: 1 }, apis: {} };
  const fetchMock = jest.fn().mockImplementation(async () => fakeResponse(200, body));
  global.fetch = fetchMock as unknown as typeof fetch;
  await Promise.all([apiClient.getDashboard(), apiClient.getHealth()]);
  await apiClient.getHealth();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
