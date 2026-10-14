import { act, render } from '@testing-library/react';
import HealthMonitor from '../src/components/HealthMonitor';
import { apiClient } from '../src/lib/api';

jest.mock('../src/lib/api', () => ({apiClient: {getHealth: jest.fn()}}));

class FakeSocket {
  static CLOSING = 2;
  static instances: FakeSocket[] = [];
  readyState = 0;
  onmessage: ((event: {data: string}) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() { FakeSocket.instances.push(this); }
  close() { this.readyState = 3; this.onclose?.(); }
  update() {
    this.readyState = 1;
    this.onmessage?.({data: JSON.stringify({type: 'health_update', timestamp: '2026-10-14T00:00:00Z', apis: {GitHub: {status: 'healthy', latency_ms: 10, last_checked: '2026-10-14T00:00:00Z'}}})});
  }
}

describe('health subscription resource usage', () => {
  const originalFetch = global.fetch;
  const originalSocket = global.WebSocket;
  let visible = true;
  beforeEach(() => {
    jest.useFakeTimers(); jest.setSystemTime(1000000);
    visible = true; FakeSocket.instances = [];
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden');
    global.WebSocket = FakeSocket as unknown as typeof WebSocket;
    global.fetch = jest.fn().mockResolvedValue({ok: true, json: async () => ({health_websocket_url: 'wss://example.test/ws/health'})});
    (apiClient.getHealth as jest.Mock).mockReset().mockResolvedValue({status: 'success', apis: {}});
  });
  afterEach(() => { global.fetch = originalFetch; global.WebSocket = originalSocket; jest.useRealTimers(); jest.restoreAllMocks(); });
  const tick = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };

  it('uses fresh socket updates instead of duplicate HTTP polling, with stale-stream recovery', async () => {
    const view = render(<HealthMonitor />);
    await tick(0);
    expect(apiClient.getHealth).toHaveBeenCalledTimes(1);
    act(() => FakeSocket.instances[0].update());
    await tick(60000);
    expect(apiClient.getHealth).toHaveBeenCalledTimes(1);
    await tick(60000);
    expect(apiClient.getHealth).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it('closes the socket and stops requests when hidden, then reconnects when visible', async () => {
    const view = render(<HealthMonitor />);
    await tick(0);
    visible = false;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(FakeSocket.instances[0].readyState).toBe(3);
    await tick(600000);
    expect(apiClient.getHealth).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(1);
    visible = true;
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await tick(0);
    expect(apiClient.getHealth).toHaveBeenCalledTimes(2);
    expect(FakeSocket.instances).toHaveLength(2);
    view.unmount();
  });

  it('backs off socket failures and cancels reconnect after unmount', async () => {
    const view = render(<HealthMonitor />);
    await tick(0);
    act(() => FakeSocket.instances[0].close());
    await tick(5000);
    expect(FakeSocket.instances).toHaveLength(2);
    act(() => FakeSocket.instances[1].close());
    await tick(5000);
    expect(FakeSocket.instances).toHaveLength(2);
    await tick(5000);
    expect(FakeSocket.instances).toHaveLength(3);
    act(() => FakeSocket.instances[2].close());
    view.unmount();
    await tick(60000);
    expect(FakeSocket.instances).toHaveLength(3);
  });
});
