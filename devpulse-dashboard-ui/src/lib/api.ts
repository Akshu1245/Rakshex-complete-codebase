const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  || (typeof window !== 'undefined' ? '' : (process.env.BACKEND_URL || 'http://localhost:8001'));
const UI_ONLY_MODE = (process.env.NEXT_PUBLIC_UI_ONLY || 'false').toLowerCase() === 'true';

// Track backend connectivity state
let _backendOnline = true;
let _lastConnectCheck = 0;

export function isBackendOnline(): boolean {
  return _backendOnline;
}

export function getBackendStatus(): { online: boolean; lastCheck: number } {
  return { online: _backendOnline, lastCheck: _lastConnectCheck };
}

// =============================================================================
// TYPES
// =============================================================================

export interface HealthStatus {
  status: string;
  timestamp: string;
  apis: Record<string, {
    status: string;
    latency_ms: number;
    last_check: string;
  }>;
}

export interface DashboardData {
  total_apis: number;
  healthy_apis: number;
  avg_latency_ms: number;
  uptime_percentage: number;
  last_updated: string;
}

export interface CompatibilityResult {
  compatible: boolean;
  score: number;
  path: string[];
  message: string;
}

export interface GenerateResult {
  code: string;
  apis_used: string[];
  tokens_used: number;
  status: string;
  language?: string;
  message?: string;
  validation?: {
    is_valid: boolean;
    score: number;
    passed_checks: string[];
    failed_checks: string[];
    suggestions: string[];
    grade: string;
  };
  auto_repaired?: boolean;
}

export interface DocsResult {
  summary: string;
  sources: string[];
  status: string;
}

export interface AuthUser {
  id: number;
  email: string;
  username: string;
  plan: string;
  api_calls_today?: number;
  api_limit?: number;
}

export interface AuthResponse {
  status: string;
  token?: string;
  user?: AuthUser;
  message?: string;
}

export interface HistoryItem {
  id: number;
  use_case: string;
  language: string;
  generated_code: string;
  apis_used: string[];
  validation_score: number;
  validation_grade: string;
  status: string;
  tokens_used: number;
  created_at: string;
}

export interface HistoryResponse {
  status: string;
  history: HistoryItem[];
  count: number;
}

// ─── Change Detection Types ─────────────────────────────────

export interface ChangeAlert {
  id: string;
  api_name: string;
  change_type: string;
  changes: {
    added: string[];
    removed: string[];
    type_changed: Record<string, { old: string; new: string }>;
  };
  detected_at: string;
  acknowledged: boolean;
  severity: string;
}

// ─── Security Scanner Types ─────────────────────────────────

export interface SecurityVulnerability {
  rule_id: string;
  owasp_category: string;
  severity: string;
  title: string;
  description: string;
  line_number: number;
  matched_text: string;
  recommendation: string;
}

export interface SecurityScanResult {
  status: string;
  score: number;
  grade: string;
  total_issues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
}

// ─── Incident Types ─────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  timestamp: string;
  status: string;
  message: string;
  author: string;
}

export interface Incident {
  id: string;
  api_name: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  detected_by: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  duration_seconds: number | null;
  timeline: TimelineEvent[];
  affected_services: string[];
  root_cause: string | null;
  resolution: string | null;
}

export interface IncidentStats {
  total_incidents: number;
  active_incidents: number;
  resolved_incidents: number;
  incidents_24h: number;
  incidents_7d: number;
  avg_resolution_seconds: number;
  mttr_minutes: number;
  by_severity: Record<string, number>;
  by_api: Record<string, number>;
}

// ─── Analytics Types ────────────────────────────────────────

export interface AnalyticsTrends {
  period_days: number;
  daily: Array<{
    date: string;
    total_events: number;
    api_calls: number;
    code_generations: number;
    errors: number;
  }>;
  totals: {
    total_events: number;
    api_calls: number;
    code_generations: number;
    errors: number;
  };
}

export interface AnalyticsInsight {
  type: string;
  severity: string;
  message: string;
  recommendation: string;
}

// ─── Alert Types ────────────────────────────────────────────

export interface AlertConfig {
  id: string;
  name: string;
  channel: string;
  target: string;
  conditions: Record<string, unknown>;
  priority: string;
  enabled: boolean;
  created_at: string;
  last_triggered: string | null;
  trigger_count: number;
}

export interface KillSwitch {
  api_name: string;
  active: boolean;
  reason: string;
  activated_by: string;
  activated_at: string;
  deactivated_at: string | null;
}

// ─── Team Types ─────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

// ─── Marketplace Types ──────────────────────────────────────

export interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  category: string;
  tags: string[];
  language: string;
  apis_used: string[];
  code: string;
  downloads: number;
  rating: number;
  review_count: number;
  version: string;
  created_at: string;
  verified: boolean;
}

// Budget & API Key types
export interface ApiKeyInfo {
  id: number;
  key_name: string;
  api_provider: string;
  masked_key: string;
  budget_limit: number | null;
  budget_used: number;
  budget_period: string;
  call_limit: number | null;
  call_count: number;
  is_active: boolean;
  created_at: string;
  last_used: string | null;
}

export interface BudgetSummary {
  status: string;
  overall: {
    budget_limit: number | null;
    budget_used: number;
    alert_threshold: number;
    budget_period: string;
    remaining: number | null;
    usage_percent: number | null;
  };
  keys: ApiKeyInfo[];
  total_keys: number;
  active_keys: number;
}

export interface BudgetLog {
  id: number;
  event_type: string;
  description: string;
  amount: number | null;
  created_at: string;
}

interface DashboardApiItem {
  name?: string;
  status?: string;
  latency_ms?: number;
  last_checked?: string;
}

interface DashboardResponse {
  status?: string;
  apis?: Record<string, DashboardApiItem>;
  summary?: {
    total?: number;
    healthy?: number;
    last_run?: string;
  };
}

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_APIS: Record<string, DashboardApiItem> = {
  'OpenWeatherMap': { status: 'healthy', latency_ms: 142, last_checked: new Date().toISOString() },
  'NASA': { status: 'healthy', latency_ms: 211, last_checked: new Date().toISOString() },
  'GitHub': { status: 'healthy', latency_ms: 98, last_checked: new Date().toISOString() },
  'Twitter': { status: 'degraded', latency_ms: 480, last_checked: new Date().toISOString() },
  'Stripe': { status: 'healthy', latency_ms: 173, last_checked: new Date().toISOString() },
  'Twilio': { status: 'healthy', latency_ms: 165, last_checked: new Date().toISOString() },
  'SendGrid': { status: 'degraded', latency_ms: 420, last_checked: new Date().toISOString() },
  'Spotify': { status: 'healthy', latency_ms: 189, last_checked: new Date().toISOString() },
  'Google Maps': { status: 'healthy', latency_ms: 155, last_checked: new Date().toISOString() },
  'CoinGecko': { status: 'healthy', latency_ms: 132, last_checked: new Date().toISOString() },
  'Reddit': { status: 'degraded', latency_ms: 398, last_checked: new Date().toISOString() },
  'Slack': { status: 'healthy', latency_ms: 144, last_checked: new Date().toISOString() },
  'Discord': { status: 'healthy', latency_ms: 161, last_checked: new Date().toISOString() },
  'NewsAPI': { status: 'degraded', latency_ms: 510, last_checked: new Date().toISOString() },
  'OpenAI': { status: 'healthy', latency_ms: 176, last_checked: new Date().toISOString() },
};

function buildMockHealth(): HealthStatus {
  return {
    status: 'success',
    timestamp: new Date().toISOString(),
    apis: Object.fromEntries(
      Object.entries(MOCK_APIS).map(([name, value]) => [
        name,
        {
          status: value.status || 'healthy',
          latency_ms: value.latency_ms || 0,
          last_check: value.last_checked || new Date().toISOString(),
        },
      ])
    ),
  };
}

function buildMockDashboard(): DashboardData {
  const total = Object.keys(MOCK_APIS).length;
  const healthy = Object.values(MOCK_APIS).filter((api) => api.status === 'healthy').length;
  const latencies = Object.values(MOCK_APIS).map((api) => Number(api.latency_ms || 0));
  const avg = latencies.length ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : 0;

  return {
    total_apis: total,
    healthy_apis: healthy,
    avg_latency_ms: Number(avg.toFixed(2)),
    uptime_percentage: Number(((healthy / total) * 100).toFixed(1)),
    last_updated: new Date().toISOString(),
  };
}

// =============================================================================
// AUTH TOKEN MANAGEMENT
// =============================================================================

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    if (typeof window !== 'undefined') localStorage.setItem('devpulse_token', token);
  } else {
    if (typeof window !== 'undefined') localStorage.removeItem('devpulse_token');
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('devpulse_token');
  }
  return authToken;
}

// =============================================================================
// API CLIENT
// =============================================================================

class APIClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  private async safeRequest<T>(
    path: string,
    init: RequestInit | undefined,
    fallback: () => T
  ): Promise<T> {
    if (UI_ONLY_MODE) {
      return fallback();
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...this.getHeaders(),
          ...(init?.headers || {}),
        },
      });
      // Backend responded — mark as online
      _backendOnline = true;
      _lastConnectCheck = Date.now();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (errorData?.error) {
          throw new Error(errorData.error);
        }
        // Non-ok HTTP response (4xx/5xx) — throw, don't silently fall back
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      return await response.json() as T;
    } catch (err) {
      const isNetworkError = err instanceof TypeError ||
        (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('ECONNREFUSED')));

      if (isNetworkError) {
        // Backend is truly unreachable
        _backendOnline = false;
        _lastConnectCheck = Date.now();
        console.warn(`[DevPulse] Backend offline — ${path}`);
        // Return fallback for network errors so UI doesn't crash,
        // but the offline banner will show
        return fallback();
      }

      // Re-throw application errors (auth failures, validation errors, etc.)
      throw err;
    }
  }

  // ---- AUTH ----

  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (data.token) setAuthToken(data.token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.token) setAuthToken(data.token);
    return data;
  }

  async getMe(): Promise<AuthResponse> {
    const token = getAuthToken();
    if (!token) return { status: 'error', message: 'Not logged in' };
    try {
      const res = await fetch(`${this.baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json();
    } catch {
      return { status: 'error', message: 'Failed to fetch user' };
    }
  }

  logout() {
    setAuthToken(null);
  }

  // ---- HEALTH ----

  async getHealth(): Promise<HealthStatus> {
    if (UI_ONLY_MODE) return buildMockHealth();

    const data = await this.safeRequest<DashboardResponse>(
      '/api/dashboard',
      undefined,
      () => ({ status: 'success', apis: MOCK_APIS, summary: { last_run: new Date().toISOString() } })
    );

    const apis = data.apis || MOCK_APIS;
    return {
      status: data.status || 'success',
      timestamp: data.summary?.last_run || new Date().toISOString(),
      apis: Object.fromEntries(
        Object.entries(apis).map(([name, value]) => [
          name,
          {
            status: value.status || 'healthy',
            latency_ms: Number(value.latency_ms || 0),
            last_check: value.last_checked || new Date().toISOString(),
          },
        ])
      ),
    };
  }

  // ---- DASHBOARD ----

  async getDashboard(): Promise<DashboardData> {
    if (UI_ONLY_MODE) return buildMockDashboard();

    const data = await this.safeRequest<DashboardResponse>(
      '/api/dashboard',
      undefined,
      () => ({ status: 'success', apis: MOCK_APIS, summary: { total: 15, healthy: 11, last_run: new Date().toISOString() } })
    );

    const summary = data.summary || {};
    const total = Number(summary.total || 0);
    const healthy = Number(summary.healthy || 0);
    const apis = (data.apis || MOCK_APIS) as Record<string, DashboardApiItem>;
    const latencies = Object.values(apis)
      .map((api) => Number(api?.latency_ms || 0))
      .filter((value) => value > 0);
    const avgLatency = latencies.length
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 0;

    return {
      total_apis: total,
      healthy_apis: healthy,
      avg_latency_ms: Number(avgLatency.toFixed(2)),
      uptime_percentage: total > 0 ? Number(((healthy / total) * 100).toFixed(1)) : 0,
      last_updated: summary.last_run || new Date().toISOString(),
    };
  }

  // ---- COMPATIBILITY ----

  async checkCompatibility(api1: string, api2: string): Promise<CompatibilityResult> {
    const data = await this.safeRequest<{ score?: number; path?: string[]; reason?: string; error?: string }>(
      '/api/compatibility',
      {
        method: 'POST',
        body: JSON.stringify({ api1, api2 }),
      },
      () => {
        const same = api1 === api2;
        const mockScore = same ? 100 : Math.max(30, 85 - Math.abs(api1.length - api2.length) * 6);
        return {
          score: mockScore,
          path: same ? [api1] : [api1, api2],
          reason: same ? 'Same API - perfect compatibility' : 'UI-only mode mock result',
        };
      }
    );

    return {
      compatible: Number(data?.score || 0) >= 50,
      score: Number(data?.score || 0),
      path: Array.isArray(data?.path) ? data.path : [],
      message: data?.reason || data?.error || 'Compatibility check completed',
    };
  }

  // ---- CODE GENERATION ----

  async generateCode(useCase: string, language: string = 'python'): Promise<GenerateResult> {
    return this.safeRequest<GenerateResult>(
      '/api/generate',
      {
        method: 'POST',
        body: JSON.stringify({ use_case: useCase, language }),
      },
      () => ({
        code: `// UI-only demo for: ${useCase}\n// Language: ${language}\nconsole.log("Connect backend for real AI generation");`,
        apis_used: ['OpenWeatherMap', 'GitHub'],
        tokens_used: 0,
        status: 'success',
        language,
        message: 'Generated in UI-only mode (mock).',
        validation: {
          is_valid: true,
          score: 88,
          passed_checks: ['has_async', 'has_main', 'has_error_handling'],
          failed_checks: [],
          suggestions: [],
          grade: 'B',
        },
      })
    );
  }

  // ---- DOCS ----

  async searchDocs(question: string): Promise<DocsResult> {
    return this.safeRequest<DocsResult>(
      '/api/docs',
      {
        method: 'POST',
        body: JSON.stringify({ question }),
      },
      () => ({
        summary: `UI-only mode: '${question}'\n\nUse exponential backoff, honor Retry-After headers, and add request caching with bounded retries.`,
        sources: ['https://developer.mozilla.org/', 'https://docs.python.org/3/library/asyncio.html'],
        status: 'success',
      })
    );
  }

  // ---- HISTORY ----

  async getHistory(limit: number = 20): Promise<HistoryResponse> {
    return this.safeRequest<HistoryResponse>(
      `/api/history?limit=${limit}`,
      undefined,
      () => ({ status: 'success', history: [], count: 0 })
    );
  }

  // ---- BUDGET & API KEYS ----

  async getApiKeys(): Promise<{ status: string; keys: ApiKeyInfo[] }> {
    return this.safeRequest(
      '/api/keys',
      undefined,
      () => ({ status: 'success', keys: [] })
    );
  }

  async addApiKey(data: {
    key_name: string;
    api_provider: string;
    api_key: string;
    budget_limit?: number | null;
    budget_period?: string;
    call_limit?: number | null;
  }): Promise<{ status: string; message: string; key_id?: number }> {
    return this.safeRequest(
      '/api/keys',
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async updateApiKey(id: number, data: {
    key_name?: string;
    budget_limit?: number | null;
    budget_period?: string;
    call_limit?: number | null;
    is_active?: boolean;
  }): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      `/api/keys/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async deleteApiKey(id: number): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      `/api/keys/${id}`,
      { method: 'DELETE' },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async getBudgetSummary(): Promise<BudgetSummary> {
    return this.safeRequest<BudgetSummary>(
      '/api/budget',
      undefined,
      () => ({
        status: 'success',
        overall: { budget_limit: null, budget_used: 0, alert_threshold: 80, budget_period: 'monthly', remaining: null, usage_percent: null },
        keys: [],
        total_keys: 0,
        active_keys: 0,
      })
    );
  }

  async setOverallBudget(data: {
    budget_limit: number;
    alert_threshold?: number;
    budget_period?: string;
  }): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      '/api/budget/overall',
      { method: 'PUT', body: JSON.stringify(data) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async resetBudget(): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      '/api/budget/reset',
      { method: 'POST' },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async resetKeyBudget(keyId: number): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      `/api/budget/reset/${keyId}`,
      { method: 'POST' },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  // ---- CHANGE DETECTION ----

  async getChangeAlerts(limit = 50): Promise<{ alerts: ChangeAlert[]; count: number }> {
    return this.safeRequest(
      `/api/changes/alerts?limit=${limit}`,
      undefined,
      () => ({ alerts: [], count: 0 })
    );
  }

  async ackChangeAlert(alertId: string): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/changes/alerts/${alertId}/ack`,
      { method: 'POST' },
      () => ({ status: 'error' })
    );
  }

  // ---- SECURITY SCANNER ----

  async scanCode(code: string, language = 'python'): Promise<SecurityScanResult> {
    return this.safeRequest(
      '/api/security/scan/code',
      { method: 'POST', body: JSON.stringify({ code, language }) },
      () => ({ status: 'success', score: 100, grade: 'A', total_issues: 0, critical: 0, high: 0, medium: 0, low: 0, vulnerabilities: [], recommendations: [] })
    );
  }

  // ---- MOCK SERVER ----

  async getMockResponse(apiName: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/mock/response/${encodeURIComponent(apiName)}`,
      undefined,
      () => ({ status: 'success', mock: true, data: {} })
    );
  }

  async getAllMockResponses(): Promise<{ apis: Record<string, unknown>; count: number }> {
    return this.safeRequest(
      '/api/mock/responses',
      undefined,
      () => ({ apis: {}, count: 0 })
    );
  }

  async mockGenerate(useCase: string, language = 'python'): Promise<GenerateResult> {
    return this.safeRequest(
      '/api/mock/generate',
      { method: 'POST', body: JSON.stringify({ use_case: useCase, language }) },
      () => ({ code: '// Offline mode', apis_used: [], tokens_used: 0, status: 'success' })
    );
  }

  // ---- INCIDENTS ----

  async getIncidents(limit = 50, status?: string, severity?: string): Promise<{ incidents: Incident[]; count: number }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    return this.safeRequest(
      `/api/incidents/?${params}`,
      undefined,
      () => ({ incidents: [], count: 0 })
    );
  }

  async createIncident(data: { title: string; description?: string; affected_apis?: string[]; severity?: string; detected_by?: string }): Promise<{ status: string; incident_id?: string }> {
    return this.safeRequest(
      '/api/incidents',
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error' })
    );
  }

  async getIncidentStats(): Promise<IncidentStats> {
    return this.safeRequest(
      '/api/incidents/stats',
      undefined,
      () => ({ total_incidents: 0, active_incidents: 0, resolved_incidents: 0, incidents_24h: 0, incidents_7d: 0, avg_resolution_seconds: 0, mttr_minutes: 0, by_severity: {}, by_api: {} })
    );
  }

  async resolveIncident(id: string, data: { root_cause?: string; resolution?: string }): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/incidents/${id}/resolve`,
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error' })
    );
  }

  // ---- CI/CD ----

  async cicdCheck(data: { code: string; language?: string; pipeline_id?: string; repo?: string; branch?: string; min_score?: number }): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/cicd/check',
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error', passed: false, verdict: 'ERROR' })
    );
  }

  async getCicdRuns(limit = 20): Promise<{ runs: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      `/api/cicd/runs?limit=${limit}`,
      undefined,
      () => ({ runs: [], count: 0 })
    );
  }

  // ---- ANALYTICS ----

  async getAnalyticsTrends(days = 30): Promise<AnalyticsTrends> {
    return this.safeRequest(
      `/api/analytics/trends?days=${days}`,
      undefined,
      () => ({ period_days: days, daily: [], totals: { total_events: 0, api_calls: 0, code_generations: 0, errors: 0 } })
    );
  }

  async getAnalyticsInsights(): Promise<{ insights: AnalyticsInsight[] }> {
    return this.safeRequest(
      '/api/analytics/insights',
      undefined,
      () => ({ insights: [] })
    );
  }

  async getAnalyticsForecast(daysAhead = 7): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/analytics/forecast?days_ahead=${daysAhead}`,
      undefined,
      () => ({ forecast: [], confidence: 'low' })
    );
  }

  // ---- ALERTS & KILL-SWITCH ----

  async getAlertConfigs(): Promise<{ configs: AlertConfig[]; count: number }> {
    return this.safeRequest(
      '/api/alerts/configs',
      undefined,
      () => ({ configs: [], count: 0 })
    );
  }

  async createAlertConfig(data: { name: string; channel: string; event_types?: string[]; destination?: string; threshold?: number }): Promise<{ status: string; config_id?: string }> {
    return this.safeRequest(
      '/api/alerts/configs',
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error' })
    );
  }

  async deleteAlertConfig(id: string): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/alerts/configs/${id}`,
      { method: 'DELETE' },
      () => ({ status: 'error' })
    );
  }

  async getAlertHistory(limit = 50): Promise<{ alerts: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      `/api/alerts/history?limit=${limit}`,
      undefined,
      () => ({ alerts: [], count: 0 })
    );
  }

  async activateKillSwitch(apiName: string, reason = ''): Promise<{ status: string; kill_switch?: KillSwitch }> {
    return this.safeRequest(
      '/api/alerts/kill-switch/activate',
      { method: 'POST', body: JSON.stringify({ api_name: apiName, reason }) },
      () => ({ status: 'error' })
    );
  }

  async deactivateKillSwitch(apiName: string): Promise<{ status: string }> {
    return this.safeRequest(
      '/api/alerts/kill-switch/deactivate',
      { method: 'POST', body: JSON.stringify({ api_name: apiName }) },
      () => ({ status: 'error' })
    );
  }

  async getKillSwitches(): Promise<{ kill_switches: Record<string, KillSwitch>; active: string[] }> {
    return this.safeRequest(
      '/api/alerts/kill-switch',
      undefined,
      () => ({ kill_switches: {}, active: [] })
    );
  }

  // ---- TEAMS ----

  async createWorkspace(name: string, ownerId: string): Promise<{ status: string; workspace?: Workspace }> {
    return this.safeRequest(
      '/api/teams/workspaces',
      { method: 'POST', body: JSON.stringify({ name, owner_id: ownerId }) },
      () => ({ status: 'error' })
    );
  }

  async getWorkspaceMembers(workspaceId: string): Promise<{ members: TeamMember[]; count: number }> {
    return this.safeRequest(
      `/api/teams/workspaces/${workspaceId}/members`,
      undefined,
      () => ({ members: [], count: 0 })
    );
  }

  async getRoles(): Promise<{ roles: Record<string, string[]> }> {
    return this.safeRequest(
      '/api/teams/roles',
      undefined,
      () => ({ roles: {} })
    );
  }

  // ---- MARKETPLACE ----

  async getMarketplaceTemplates(params?: { category?: string; language?: string; search?: string }): Promise<{ templates: MarketplaceTemplate[]; count: number }> {
    const sp = new URLSearchParams();
    if (params?.category) sp.set('category', params.category);
    if (params?.language) sp.set('language', params.language);
    if (params?.search) sp.set('search', params.search);
    return this.safeRequest(
      `/api/marketplace/templates?${sp}`,
      undefined,
      () => ({ templates: [], count: 0 })
    );
  }

  async installTemplate(templateId: string): Promise<{ status: string; code?: string; name?: string }> {
    return this.safeRequest(
      `/api/marketplace/templates/${templateId}/install`,
      { method: 'POST' },
      () => ({ status: 'error' })
    );
  }

  async getMarketplaceStats(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/marketplace/stats',
      undefined,
      () => ({ total_templates: 0, total_downloads: 0 })
    );
  }

  // ---- BILLING ----

  async getBillingPlans(): Promise<{ status: string; plans: Record<string, { name: string; price_monthly: number; price_yearly: number; api_calls_day: number; features: string[] }> }> {
    return this.safeRequest(
      '/api/billing/plans',
      undefined,
      () => ({
        status: 'success',
        plans: {
          free: { name: 'Free', price_monthly: 0, price_yearly: 0, api_calls_day: 50, features: ['Health monitoring', 'Basic dashboard'] },
          pro: { name: 'Pro', price_monthly: 29, price_yearly: 290, api_calls_day: 500, features: ['Everything in Free', 'Advanced features'] },
          enterprise: { name: 'Enterprise', price_monthly: 99, price_yearly: 990, api_calls_day: 10000, features: ['Everything in Pro', 'Team & RBAC'] },
        },
      })
    );
  }

  async subscribePlan(plan: string, billingPeriod = 'monthly'): Promise<{ status: string; message?: string; plan?: string; amount_usd?: number }> {
    return this.safeRequest(
      '/api/billing/subscribe',
      { method: 'POST', body: JSON.stringify({ plan, billing_period: billingPeriod }) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async getBillingStatus(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/status',
      undefined,
      () => ({ status: 'success', plan: 'free', api_calls_today: 0, api_limit: 50 })
    );
  }

  async getBillingHistory(): Promise<{ status: string; history: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      '/api/billing/history',
      undefined,
      () => ({ status: 'success', history: [], count: 0 })
    );
  }

  async cancelSubscription(reason?: string): Promise<{ status: string; message?: string }> {
    return this.safeRequest(
      '/api/billing/cancel',
      { method: 'POST', body: JSON.stringify({ reason }) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  // ---- CUSTOM API / OPENAPI IMPORT ----

  async importOpenAPI(data: { url?: string; spec_json?: Record<string, unknown>; protocol?: string }): Promise<{ status: string; api_name?: string; endpoint_count?: number; paths?: string[] }> {
    return this.safeRequest(
      '/api/custom/import',
      { method: 'POST', body: JSON.stringify(data) },
      () => ({ status: 'error' })
    );
  }

  async getCustomApis(): Promise<{ status: string; apis: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      '/api/custom/apis',
      undefined,
      () => ({ status: 'success', apis: [], count: 0 })
    );
  }

  async deleteCustomApi(apiId: number): Promise<{ status: string; message?: string }> {
    return this.safeRequest(
      `/api/custom/apis/${apiId}`,
      { method: 'DELETE' },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  // ---- REPORTS ----

  async getReportSummary(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/reports/summary',
      undefined,
      () => ({ status: 'success', summary: {} })
    );
  }

  async exportReport(reportType = 'analytics', format = 'json', days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/reports/export?report_type=${reportType}&format=${format}&days=${days}`,
      undefined,
      () => ({ status: 'error' })
    );
  }

  // ---- ONBOARDING ----

  async onboardingSignup(email: string, username: string, password: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/signup',
      { method: 'POST', body: JSON.stringify({ email, username, password }) },
      () => ({ status: 'error', message: 'UI-only mode' })
    );
  }

  async getOnboardingStatus(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/status',
      undefined,
      () => ({ status: 'success', steps: [], completed: [], progress_percent: 0 })
    );
  }

  async completeOnboardingStep(stepId: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/complete',
      { method: 'POST', body: JSON.stringify({ step_id: stepId }) },
      () => ({ status: 'error' })
    );
  }

  async getTrialInfo(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/trial-info',
      undefined,
      () => ({ status: 'success', trial_active: false, trial_days_remaining: 0 })
    );
  }

  // ---- STRIPE CHECKOUT ----

  async createCheckout(plan: string, billingPeriod = 'monthly'): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify({ plan, billing_period: billingPeriod }) },
      () => ({ status: 'error', error: 'UI-only mode' })
    );
  }

  async createBillingPortal(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/portal',
      { method: 'POST' },
      () => ({ status: 'error', error: 'UI-only mode' })
    );
  }

  // ===========================================================================
  // AI SECURITY SCANNER (Pillar 1)
  // ===========================================================================

  async scanTokenLeaks(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/tokens',
      { method: 'POST', body: JSON.stringify({ code }) },
      () => ({ leaks: [], count: 0 })
    );
  }

  async scanAgentAttacks(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/agents',
      { method: 'POST', body: JSON.stringify({ code }) },
      () => ({ attacks: [], count: 0 })
    );
  }

  async scanOwaspApi(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/owasp',
      { method: 'POST', body: JSON.stringify({ code }) },
      () => ({ violations: [], count: 0 })
    );
  }

  async fullSecurityScan(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/full',
      { method: 'POST', body: JSON.stringify({ code }) },
      () => ({
        score: 100,
        grade: 'A',
        token_leaks: [],
        agent_attacks: [],
        owasp_violations: [],
        total_issues: 0,
        scan_id: 'demo',
      })
    );
  }

  async getFixSuggestions(code: string, issues: Record<string, unknown>[]): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/fix-suggestions',
      { method: 'POST', body: JSON.stringify({ code, issues }) },
      () => ({ suggestions: [], ai_powered: false })
    );
  }

  async getThreatFeed(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/threat-feed',
      undefined,
      () => ({ threats: [], updated: new Date().toISOString() })
    );
  }

  async scanApiInventory(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/inventory',
      { method: 'POST', body: JSON.stringify({ code }) },
      () => ({ providers: [], count: 0 })
    );
  }

  async getSecurityScoreHistory(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/score-history',
      undefined,
      () => ({ history: [] })
    );
  }

  // ===========================================================================
  // COST INTELLIGENCE (Pillar 2)
  // ===========================================================================

  async getModelPricing(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/models',
      undefined,
      () => ({ models: {} })
    );
  }

  async calculateCost(model: string, inputTokens: number, outputTokens: number): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/calculate',
      { method: 'POST', body: JSON.stringify({ model, input_tokens: inputTokens, output_tokens: outputTokens }) },
      () => ({ total_cost: 0, model })
    );
  }

  async getCostBreakdown(days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/v1/costs/breakdown?days=${days}`,
      undefined,
      () => ({ by_provider: {}, by_model: {}, by_day: {}, total: 0 })
    );
  }

  async getCostForecast(days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/v1/costs/forecast?days=${days}`,
      undefined,
      () => ({ forecasted_daily: 0, forecasted_total: 0, confidence: 'low', data_points: 0 })
    );
  }

  async getCostAnomalies(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/anomalies',
      undefined,
      () => ({ anomalies: [], count: 0 })
    );
  }

  async getOptimizationTips(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/optimization',
      undefined,
      () => ({ tips: [], potential_savings: 0 })
    );
  }

  async calculateROI(monthlyCost: number, teamSize: number): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/roi',
      { method: 'POST', body: JSON.stringify({ monthly_api_cost: monthlyCost, team_size: teamSize }) },
      () => ({ monthly_savings: 0, annual_savings: 0, roi_percentage: 0 })
    );
  }

  async getCostDashboard(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/dashboard',
      undefined,
      () => ({
        breakdown: { by_provider: {}, by_model: {}, by_day: {}, total: 0 },
        forecast: { forecasted_daily: 0 },
        anomalies: { anomalies: [] },
        optimization: { tips: [] },
      })
    );
  }

  async createCostBudget(provider: string, monthlyLimit: number, alertThreshold = 0.8): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/budgets',
      { method: 'POST', body: JSON.stringify({ provider, monthly_limit: monthlyLimit, alert_threshold: alertThreshold }) },
      () => ({ status: 'error' })
    );
  }

  async getCostBudgets(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/budgets',
      undefined,
      () => ({ budgets: [] })
    );
  }
}

export const apiClient = new APIClient();
