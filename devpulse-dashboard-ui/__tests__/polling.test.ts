import { startPolling } from '../src/lib/polling';

describe('quota-aware polling', () => {
  let visible = true;
  let online = true;
  let stop: (() => void) | undefined;
  beforeEach(() => {
    jest.useFakeTimers();
    visible = true; online = true;
    jest.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visible ? 'visible' : 'hidden');
    jest.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
  });
  afterEach(() => { stop?.(); stop = undefined; jest.useRealTimers(); jest.restoreAllMocks(); });

  it('loads immediately and waits a full minute after completion', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(0);
    expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(59999);
    expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('stops polling hidden tabs and refreshes when visible again', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(0);
    visible = false; document.dispatchEvent(new Event('visibilitychange'));
    await jest.advanceTimersByTimeAsync(600000);
    expect(task).toHaveBeenCalledTimes(1);
    visible = true; document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('waits for network recovery rather than repeatedly failing offline', async () => {
    online = false;
    const task = jest.fn().mockResolvedValue(undefined);
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(600000);
    expect(task).not.toHaveBeenCalled();
    online = true; window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('does not overlap a slow request during timer and focus events', async () => {
    let finish!: () => void;
    const task = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(180000);
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    expect(task).toHaveBeenCalledTimes(1);
    finish(); await Promise.resolve();
    await jest.advanceTimersByTimeAsync(60000);
    expect(task).toHaveBeenCalledTimes(2);
    finish();
  });

  it('does not restart after unmount while a request is finishing', async () => {
    let finish!: () => void;
    const task = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(0);
    stop(); finish(); await Promise.resolve();
    window.dispatchEvent(new Event('online'));
    await jest.advanceTimersByTimeAsync(600000);
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('retries rejected work without an unhandled rejection or busy loop', async () => {
    const task = jest.fn().mockRejectedValue(new Error('503'));
    stop = startPolling(task);
    await jest.advanceTimersByTimeAsync(120000);
    expect(task).toHaveBeenCalledTimes(3);
  });
});
