export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ||
  (typeof window === 'undefined' ? process.env.BACKEND_URL || 'http://localhost:8000' : '')).replace(/\/$/, '');

let backendOnline = false;
let lastCheck = 0;

export function getBackendStatus() { return { online: backendOnline, lastCheck }; }
export function isBackendOnline() { return backendOnline; }

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('devpulse_token', token);
  else localStorage.removeItem('devpulse_token');
  window.dispatchEvent(new Event('devpulse-auth'));
}

export function getAuthToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem('devpulse_token');
}

export class APIError extends Error {
  constructor(message: string, public status: number) { super(message); this.name = 'APIError'; }
}

export function reportAPIError(error: APIError) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('devpulse-api-error', {
      detail: { message: error.message, status: error.status },
    }));
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init, headers, signal: init.signal || controller.signal, cache: 'no-store',
    });
    backendOnline = response.status < 500;
    lastCheck = Date.now();
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const detail = data.detail || data.error || data.message;
      const message = typeof detail === 'string' ? detail : `Request failed (${response.status})`;
      if (response.status === 401 && token) setAuthToken(null);
      throw new APIError(message, response.status);
    }
    return response;
  } catch (error) {
    if (!(error instanceof APIError)) { backendOnline = false; lastCheck = Date.now(); }
    const failure = error instanceof APIError ? error : new APIError('Unable to reach the backend. Please retry.', 0);
    reportAPIError(failure);
    throw failure;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json();
  if (data.status === 'error') {
    const error = new APIError(data.error || data.message || 'The operation failed.', response.status);
    reportAPIError(error);
    throw error;
  }
  return data as T;
}
