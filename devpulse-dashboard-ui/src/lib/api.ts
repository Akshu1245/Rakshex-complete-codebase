import { apiRequest, setAuthToken } from './transport';
export { apiFetch, APIError, API_BASE_URL, getAuthToken, setAuthToken, getBackendStatus, isBackendOnline } from './transport';

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
// API CLIENT
// =============================================================================

class APIClient {
  private async safeRequest<T>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(path, init);
  }

  // ---- AUTH ----

  async register(email: string, username: string, password: string): Promise<AuthResponse> {
    const data = await apiRequest<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({email, username, password}) });
    if (data.token) setAuthToken(data.token);
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await apiRequest<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({email, password}) });
    if (data.token) setAuthToken(data.token);
    return data;
  }

  async getMe(): Promise<AuthResponse> {
    return apiRequest<AuthResponse>('/api/auth/me');
  }

  logout() {
    setAuthToken(null);
  }

  // ---- HEALTH ----

  async getHealth(): Promise<HealthStatus> {

    const data = await this.safeRequest<DashboardResponse>(
      '/api/dashboard',
      undefined
    );

    const apis = data.apis || {};
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

    const data = await this.safeRequest<DashboardResponse>(
      '/api/dashboard',
      undefined
    );

    const summary = data.summary || {};
    const total = Number(summary.total || 0);
    const healthy = Number(summary.healthy || 0);
    const apis = (data.apis || {}) as Record<string, DashboardApiItem>;
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
      }
    );
  }

  // ---- DOCS ----

  async searchDocs(question: string): Promise<DocsResult> {
    return this.safeRequest<DocsResult>(
      '/api/docs',
      {
        method: 'POST',
        body: JSON.stringify({ question }),
      }
    );
  }

  // ---- HISTORY ----

  async getHistory(limit: number = 20): Promise<HistoryResponse> {
    return this.safeRequest<HistoryResponse>(
      `/api/history?limit=${limit}`,
      undefined
    );
  }

  // ---- BUDGET & API KEYS ----

  async getApiKeys(): Promise<{ status: string; keys: ApiKeyInfo[] }> {
    return this.safeRequest(
      '/api/keys',
      undefined
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
      { method: 'POST', body: JSON.stringify(data) }
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
      { method: 'PUT', body: JSON.stringify(data) }
    );
  }

  async deleteApiKey(id: number): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      `/api/keys/${id}`,
      { method: 'DELETE' }
    );
  }

  async getBudgetSummary(): Promise<BudgetSummary> {
    return this.safeRequest<BudgetSummary>(
      '/api/budget',
      undefined
    );
  }

  async setOverallBudget(data: {
    budget_limit: number;
    alert_threshold?: number;
    budget_period?: string;
  }): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      '/api/budget/overall',
      { method: 'PUT', body: JSON.stringify(data) }
    );
  }

  async resetBudget(): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      '/api/budget/reset',
      { method: 'POST' }
    );
  }

  async resetKeyBudget(keyId: number): Promise<{ status: string; message: string }> {
    return this.safeRequest(
      `/api/budget/reset/${keyId}`,
      { method: 'POST' }
    );
  }

  // ---- CHANGE DETECTION ----

  async getChangeAlerts(limit = 50): Promise<{ alerts: ChangeAlert[]; count: number }> {
    return this.safeRequest(
      `/api/changes/alerts?limit=${limit}`,
      undefined
    );
  }

  async ackChangeAlert(alertId: string): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/changes/alerts/${alertId}/ack`,
      { method: 'POST' }
    );
  }

  // ---- SECURITY SCANNER ----

  async scanCode(code: string, language = 'python'): Promise<SecurityScanResult> {
    return this.safeRequest(
      '/api/security/scan/code',
      { method: 'POST', body: JSON.stringify({ code, language }) }
    );
  }

  // ---- MOCK SERVER ----

  async getMockResponse(apiName: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/mock/response/${encodeURIComponent(apiName)}`,
      undefined
    );
  }

  async getAllMockResponses(): Promise<{ apis: Record<string, unknown>; count: number }> {
    return this.safeRequest(
      '/api/mock/responses',
      undefined
    );
  }

  async mockGenerate(useCase: string, language = 'python'): Promise<GenerateResult> {
    return this.safeRequest(
      '/api/mock/generate',
      { method: 'POST', body: JSON.stringify({ use_case: useCase, language }) }
    );
  }

  // ---- INCIDENTS ----

  async getIncidents(limit = 50, status?: string, severity?: string): Promise<{ incidents: Incident[]; count: number }> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    if (severity) params.set('severity', severity);
    return this.safeRequest(
      `/api/incidents?${params}`,
      undefined
    );
  }

  async createIncident(data: { title: string; description?: string; affected_apis?: string[]; severity?: string; detected_by?: string }): Promise<{ status: string; incident_id?: string }> {
    return this.safeRequest(
      '/api/incidents',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getIncidentStats(): Promise<IncidentStats> {
    return this.safeRequest(
      '/api/incidents/stats',
      undefined
    );
  }

  async resolveIncident(id: string, data: { root_cause?: string; resolution?: string }): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/incidents/${id}/resolve`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  // ---- CI/CD ----

  async cicdCheck(data: { code: string; language?: string; pipeline_id?: string; repo?: string; branch?: string; min_score?: number }): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/cicd/check',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getCicdRuns(limit = 20): Promise<{ runs: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      `/api/cicd/runs?limit=${limit}`,
      undefined
    );
  }

  // ---- ANALYTICS ----

  async getAnalyticsTrends(days = 30): Promise<AnalyticsTrends> {
    return this.safeRequest(
      `/api/analytics/trends?days=${days}`,
      undefined
    );
  }

  async getAnalyticsInsights(): Promise<{ insights: AnalyticsInsight[] }> {
    return this.safeRequest(
      '/api/analytics/insights',
      undefined
    );
  }

  async getAnalyticsForecast(daysAhead = 7): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/analytics/forecast?days_ahead=${daysAhead}`,
      undefined
    );
  }

  // ---- ALERTS & KILL-SWITCH ----

  async getAlertConfigs(): Promise<{ configs: AlertConfig[]; count: number }> {
    return this.safeRequest(
      '/api/alerts/configs',
      undefined
    );
  }

  async createAlertConfig(data: { name: string; channel: string; event_types?: string[]; destination?: string; threshold?: number }): Promise<{ status: string; config_id?: string }> {
    return this.safeRequest(
      '/api/alerts/configs',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async deleteAlertConfig(id: string): Promise<{ status: string }> {
    return this.safeRequest(
      `/api/alerts/configs/${id}`,
      { method: 'DELETE' }
    );
  }

  async getAlertHistory(limit = 50): Promise<{ alerts: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      `/api/alerts/history?limit=${limit}`,
      undefined
    );
  }

  async activateKillSwitch(apiName: string, reason = ''): Promise<{ status: string; kill_switch?: KillSwitch }> {
    return this.safeRequest(
      '/api/alerts/kill-switch/activate',
      { method: 'POST', body: JSON.stringify({ api_name: apiName, reason }) }
    );
  }

  async deactivateKillSwitch(apiName: string): Promise<{ status: string }> {
    return this.safeRequest(
      '/api/alerts/kill-switch/deactivate',
      { method: 'POST', body: JSON.stringify({ api_name: apiName }) }
    );
  }

  async getKillSwitches(): Promise<{ kill_switches: Record<string, KillSwitch>; active: string[] }> {
    return this.safeRequest(
      '/api/alerts/kill-switch',
      undefined
    );
  }

  // ---- TEAMS ----

  async createWorkspace(name: string, ownerId: string): Promise<{ status: string; workspace?: Workspace }> {
    return this.safeRequest(
      '/api/teams/workspaces',
      { method: 'POST', body: JSON.stringify({ name, owner_id: ownerId }) }
    );
  }

  async getWorkspaceMembers(workspaceId: string): Promise<{ members: TeamMember[]; count: number }> {
    return this.safeRequest(
      `/api/teams/workspaces/${workspaceId}/members`,
      undefined
    );
  }

  async getRoles(): Promise<{ roles: Record<string, string[]> }> {
    return this.safeRequest(
      '/api/teams/roles',
      undefined
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
      undefined
    );
  }

  async installTemplate(templateId: string): Promise<{ status: string; code?: string; name?: string }> {
    return this.safeRequest(
      `/api/marketplace/templates/${templateId}/install`,
      { method: 'POST' }
    );
  }

  async getMarketplaceStats(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/marketplace/stats',
      undefined
    );
  }

  // ---- BILLING ----

  async getBillingPlans(): Promise<{ status: string; plans: Record<string, { name: string; price_monthly: number; price_yearly: number; api_calls_day: number; features: string[] }> }> {
    return this.safeRequest(
      '/api/billing/plans',
      undefined
    );
  }

  async subscribePlan(plan: string, billingPeriod = 'monthly'): Promise<{ status: string; message?: string; plan?: string; amount_usd?: number; checkout_url?: string }> {
    return this.safeRequest(
      '/api/billing/subscribe',
      { method: 'POST', body: JSON.stringify({ plan, billing_period: billingPeriod }) }
    );
  }

  async getBillingStatus(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/status',
      undefined
    );
  }

  async getBillingHistory(): Promise<{ status: string; history: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      '/api/billing/history',
      undefined
    );
  }

  async cancelSubscription(reason?: string): Promise<{ status: string; message?: string }> {
    return this.safeRequest(
      '/api/billing/cancel',
      { method: 'POST', body: JSON.stringify({ reason }) }
    );
  }

  // ---- CUSTOM API / OPENAPI IMPORT ----

  async importOpenAPI(data: { url?: string; spec_json?: Record<string, unknown>; protocol?: string }): Promise<{ status: string; api_name?: string; endpoint_count?: number; paths?: string[] }> {
    return this.safeRequest(
      '/api/custom/import',
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  async getCustomApis(): Promise<{ status: string; apis: Record<string, unknown>[]; count: number }> {
    return this.safeRequest(
      '/api/custom/apis',
      undefined
    );
  }

  async deleteCustomApi(apiId: number): Promise<{ status: string; message?: string }> {
    return this.safeRequest(
      `/api/custom/apis/${apiId}`,
      { method: 'DELETE' }
    );
  }

  // ---- REPORTS ----

  async getReportSummary(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/reports/summary',
      undefined
    );
  }

  async exportReport(reportType = 'analytics', format = 'json', days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/reports/export?report_type=${reportType}&format=${format}&days=${days}`,
      undefined
    );
  }

  // ---- ONBOARDING ----

  async onboardingSignup(email: string, username: string, password: string): Promise<AuthResponse> {
    const data = await apiRequest<AuthResponse>('/api/onboarding/signup', { method: 'POST', body: JSON.stringify({email, username, password}) });
    if (data.token) setAuthToken(data.token);
    return data;
  }

  async getOnboardingStatus(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/status',
      undefined
    );
  }

  async completeOnboardingStep(stepId: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/complete',
      { method: 'POST', body: JSON.stringify({ step_id: stepId }) }
    );
  }

  async getTrialInfo(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/onboarding/trial-info',
      undefined
    );
  }

  // ---- STRIPE CHECKOUT ----

  async createCheckout(plan: string, billingPeriod = 'monthly'): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/checkout',
      { method: 'POST', body: JSON.stringify({ plan, billing_period: billingPeriod }) }
    );
  }

  async createBillingPortal(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/billing/portal',
      { method: 'POST' }
    );
  }

  // ===========================================================================
  // AI SECURITY SCANNER (Pillar 1)
  // ===========================================================================

  async scanTokenLeaks(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/tokens',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async scanAgentAttacks(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/agents',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async scanOwaspApi(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/owasp',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async fullSecurityScan(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/scan/full',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async getFixSuggestions(code: string, issues: Record<string, unknown>[]): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/fix-suggestions',
      { method: 'POST', body: JSON.stringify({ code, findings: issues }) }
    );
  }

  async getThreatFeed(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/threat-feed',
      undefined
    );
  }

  async scanApiInventory(code: string): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/inventory',
      { method: 'POST', body: JSON.stringify({ code }) }
    );
  }

  async getSecurityScoreHistory(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/security/score-history',
      undefined
    );
  }

  // ===========================================================================
  // COST INTELLIGENCE (Pillar 2)
  // ===========================================================================

  async getModelPricing(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/models',
      undefined
    );
  }

  async calculateCost(model: string, inputTokens: number, outputTokens: number): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/calculate',
      { method: 'POST', body: JSON.stringify({ provider: '', model, tokens_input: inputTokens, tokens_output: outputTokens }) }
    );
  }

  async getCostBreakdown(days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/v1/costs/breakdown?days=${days}`,
      undefined
    );
  }

  async getCostForecast(days = 30): Promise<Record<string, unknown>> {
    return this.safeRequest(
      `/api/v1/costs/forecast?days_ahead=${days}`,
      undefined
    );
  }

  async getCostAnomalies(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/anomalies',
      undefined
    );
  }

  async getOptimizationTips(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/optimization',
      undefined
    );
  }

  async calculateROI(monthlyCost: number, teamSize: number): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/roi',
      { method: 'POST', body: JSON.stringify({ monthly_api_spend: monthlyCost, hours_saved_per_month: teamSize * 10 }) }
    );
  }

  async getCostDashboard(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/dashboard',
      undefined
    );
  }

  async createCostBudget(provider: string, monthlyLimit: number, alertThreshold = 0.8): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/budgets',
      { method: 'POST', body: JSON.stringify({ name: provider || 'Overall', provider, monthly_limit_usd: monthlyLimit, alert_threshold_pct: alertThreshold * 100 }) }
    );
  }

  async getCostBudgets(): Promise<Record<string, unknown>> {
    return this.safeRequest(
      '/api/v1/costs/budgets',
      undefined
    );
  }
}

export const apiClient = new APIClient();
