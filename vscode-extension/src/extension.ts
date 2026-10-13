import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

/**
 * DevPulse VS Code Extension v0.4.0
 * AI API Security & Cost Intelligence — directly in your editor
 *
 * Commands:
 *   showDashboard       – Security score + cost overview webview
 *   fullSecurityScan    – Token leaks + agent attacks + OWASP
 *   scanTokenLeaks      – Detect exposed API keys / secrets
 *   scanAgentAttacks    – Detect prompt injection, SSRF, tool abuse
 *   costEstimate        – Estimate cost for an API call
 *   aiFixSuggestions    – Get AI-powered fix suggestions
 *   checkHealth         – Quick API health check
 *   cicdGate            – CI/CD quality gate
 *
 * Inline Diagnostics:
 *   Real-time token leak warnings as you type (configurable)
 */

// ── Inline token patterns (subset for fast client-side detection) ────────────
const TOKEN_PATTERNS: { name: string; regex: RegExp; severity: vscode.DiagnosticSeverity }[] = [
    { name: 'OpenAI API Key', regex: /sk-[A-Za-z0-9]{20,}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'Anthropic API Key', regex: /sk-ant-[A-Za-z0-9\-_]{20,}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'GitHub Token', regex: /gh[ps]_[A-Za-z0-9]{36,}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'Stripe Secret Key', regex: /sk_live_[A-Za-z0-9]{24,}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z\-_]{35}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'Groq API Key', regex: /gsk_[A-Za-z0-9]{20,}/g, severity: vscode.DiagnosticSeverity.Error },
    { name: 'Generic Secret', regex: /(?:password|secret|token|api_key)\s*[=:]\s*['"][^'"]{8,}['"]/gi, severity: vscode.DiagnosticSeverity.Warning },
];

let diagnosticCollection: vscode.DiagnosticCollection;

// ── Config helper ────────────────────────────────────────────────────────────
function getConfig() {
    const config = vscode.workspace.getConfiguration('devpulse');
    return {
        apiUrl: config.get<string>('apiUrl', 'http://localhost:8000'),
        token: config.get<string>('token', ''),
        inlineDiagnostics: config.get<boolean>('inlineDiagnostics', true),
        scanOnSave: config.get<boolean>('scanOnSave', false),
    };
}

// ── HTTP client ──────────────────────────────────────────────────────────────
async function apiRequest(path: string, method = 'GET', body?: object): Promise<any> {
    const { apiUrl, token } = getConfig();
    const url = `${apiUrl}${path}`;

    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        };

        const req = client.request(options, (res: any) => {
            let data = '';
            res.on('data', (chunk: string) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// ── Inline diagnostics engine ────────────────────────────────────────────────
function scanDocumentForTokenLeaks(document: vscode.TextDocument): void {
    const { inlineDiagnostics } = getConfig();
    if (!inlineDiagnostics) {
        diagnosticCollection.delete(document.uri);
        return;
    }

    const text = document.getText();
    const diagnostics: vscode.Diagnostic[] = [];

    for (const pattern of TOKEN_PATTERNS) {
        pattern.regex.lastIndex = 0; // reset regex state
        let match: RegExpExecArray | null;
        while ((match = pattern.regex.exec(text)) !== null) {
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            const range = new vscode.Range(startPos, endPos);

            const diagnostic = new vscode.Diagnostic(
                range,
                `DevPulse: Potential ${pattern.name} detected — never commit secrets to source control`,
                pattern.severity
            );
            diagnostic.source = 'DevPulse Security';
            diagnostic.code = 'token-leak';
            diagnostics.push(diagnostic);
        }
    }

    diagnosticCollection.set(document.uri, diagnostics);
}

// ── ACTIVATION ───────────────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
    // Create diagnostics collection
    diagnosticCollection = vscode.languages.createDiagnosticCollection('devpulse');
    context.subscriptions.push(diagnosticCollection);

    // Wire inline diagnostics
    if (vscode.window.activeTextEditor) {
        scanDocumentForTokenLeaks(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => scanDocumentForTokenLeaks(e.document)),
        vscode.workspace.onDidOpenTextDocument(scanDocumentForTokenLeaks),
        vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => {
            if (editor) { scanDocumentForTokenLeaks(editor.document); }
        })
    );

    // Scan on save (optional)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document: vscode.TextDocument) => {
            const { scanOnSave } = getConfig();
            if (scanOnSave) {
                try {
                    const code = document.getText();
                    const result = await apiRequest('/api/v1/security/scan/full', 'POST', { code });
                    const issues = result.total_issues || 0;
                    const grade = result.grade || '?';
                    if (issues > 0) {
                        vscode.window.showWarningMessage(
                            `DevPulse: ${issues} security issue(s) found (Grade: ${grade})`,
                            'View Details'
                        );
                    }
                } catch {
                    // silent fail on save scan
                }
            }
        })
    );

    // ── Command: Show Dashboard ─────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.showDashboard', async () => {
            const panel = vscode.window.createWebviewPanel(
                'devpulseDashboard',
                'DevPulse — Security & Cost Dashboard',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );

            try {
                const [health, dashboard, costDash] = await Promise.all([
                    apiRequest('/health').catch(() => ({})),
                    apiRequest('/api/dashboard').catch(() => ({})),
                    apiRequest('/api/v1/costs/dashboard').catch(() => ({})),
                ]);
                panel.webview.html = getDashboardHtml(health, dashboard, costDash);
            } catch (err) {
                panel.webview.html = `<html><body style="background:#09090b;color:#fafafa;padding:24px;font-family:sans-serif;"><h2>Failed to connect to DevPulse</h2><p>${err}</p></body></html>`;
            }
        })
    );

    // ── Command: Full Security Scan ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.fullSecurityScan', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a file to scan');
                return;
            }

            const code = editor.document.getText();

            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DevPulse: Running full security scan...' },
                async () => {
                    try {
                        const result = await apiRequest('/api/v1/security/scan/full', 'POST', { code });
                        const score = result.score ?? 100;
                        const grade = result.grade || 'A';
                        const leaks = result.token_leaks?.length || 0;
                        const attacks = result.agent_attacks?.length || 0;
                        const owasp = result.owasp_violations?.length || 0;
                        const total = result.total_issues || 0;

                        const icon = score >= 80 ? '✅' : score >= 50 ? '⚠️' : '🚨';
                        const msg = `${icon} Security Score: ${score}/100 (${grade}) — ${leaks} token leaks, ${attacks} agent attacks, ${owasp} OWASP violations`;

                        if (total > 0) {
                            const action = await vscode.window.showWarningMessage(msg, 'Get AI Fix', 'Dismiss');
                            if (action === 'Get AI Fix') {
                                vscode.commands.executeCommand('devpulse.aiFixSuggestions');
                            }
                        } else {
                            vscode.window.showInformationMessage(msg);
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Scan error: ${err}`);
                    }
                }
            );
        })
    );

    // ── Command: Scan Token Leaks ───────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.scanTokenLeaks', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a file to scan');
                return;
            }

            const code = editor.document.getText();
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DevPulse: Scanning for token leaks...' },
                async () => {
                    try {
                        const result = await apiRequest('/api/v1/security/scan/tokens', 'POST', { code });
                        const count = result.count || 0;
                        if (count > 0) {
                            const leakNames = (result.leaks || []).map((l: any) => l.pattern_name).join(', ');
                            vscode.window.showWarningMessage(`🔓 Found ${count} token leak(s): ${leakNames}`);
                        } else {
                            vscode.window.showInformationMessage('✅ No token leaks detected');
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Token scan error: ${err}`);
                    }
                }
            );
        })
    );

    // ── Command: Scan Agent Attacks ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.scanAgentAttacks', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a file to scan');
                return;
            }

            const code = editor.document.getText();
            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DevPulse: Scanning for AI agent attacks...' },
                async () => {
                    try {
                        const result = await apiRequest('/api/v1/security/scan/agents', 'POST', { code });
                        const count = result.count || 0;
                        if (count > 0) {
                            const attackNames = (result.attacks || []).map((a: any) => a.attack_type).join(', ');
                            vscode.window.showWarningMessage(`🤖 Found ${count} agent attack pattern(s): ${attackNames}`);
                        } else {
                            vscode.window.showInformationMessage('✅ No AI agent attack patterns detected');
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Agent scan error: ${err}`);
                    }
                }
            );
        })
    );

    // ── Command: Cost Estimate ──────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.costEstimate', async () => {
            const model = await vscode.window.showQuickPick(
                [
                    'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo',
                    'claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku',
                    'gemini-1.5-pro', 'gemini-1.5-flash',
                    'llama-3.1-70b', 'mixtral-8x7b',
                ],
                { placeHolder: 'Select AI model to estimate cost' }
            );
            if (!model) { return; }

            const inputStr = await vscode.window.showInputBox({
                prompt: 'Input tokens (estimated)',
                value: '1000',
                validateInput: (v: string) => isNaN(Number(v)) ? 'Enter a number' : null,
            });
            if (!inputStr) { return; }

            const outputStr = await vscode.window.showInputBox({
                prompt: 'Output tokens (estimated)',
                value: '500',
                validateInput: (v: string) => isNaN(Number(v)) ? 'Enter a number' : null,
            });
            if (!outputStr) { return; }

            try {
                const result = await apiRequest('/api/v1/costs/calculate', 'POST', {
                    model,
                    input_tokens: parseInt(inputStr, 10),
                    output_tokens: parseInt(outputStr, 10),
                });
                const cost = result.total_cost ?? 0;
                const formatted = cost < 0.01 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
                vscode.window.showInformationMessage(
                    `💸 ${model}: ${formatted} for ${inputStr} in / ${outputStr} out tokens`
                );
            } catch (err) {
                vscode.window.showErrorMessage(`Cost estimate error: ${err}`);
            }
        })
    );

    // ── Command: AI Fix Suggestions ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.aiFixSuggestions', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a file to get fix suggestions');
                return;
            }

            const code = editor.document.getText();

            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DevPulse: Getting AI fix suggestions...' },
                async () => {
                    try {
                        // First scan, then get fixes
                        const scan = await apiRequest('/api/v1/security/scan/full', 'POST', { code });
                        const issues = [
                            ...(scan.token_leaks || []),
                            ...(scan.agent_attacks || []),
                            ...(scan.owasp_violations || []),
                        ];

                        if (issues.length === 0) {
                            vscode.window.showInformationMessage('✅ No issues found — no fixes needed');
                            return;
                        }

                        const result = await apiRequest('/api/v1/security/fix-suggestions', 'POST', { code, issues });
                        const suggestions = result.suggestions || [];

                        if (suggestions.length > 0) {
                            const panel = vscode.window.createWebviewPanel(
                                'devpulseFixes',
                                'DevPulse — AI Fix Suggestions',
                                vscode.ViewColumn.Beside,
                                { enableScripts: false }
                            );
                            panel.webview.html = getFixSuggestionsHtml(suggestions, result.ai_powered || false);
                        } else {
                            vscode.window.showInformationMessage('No fix suggestions available');
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(`Fix suggestions error: ${err}`);
                    }
                }
            );
        })
    );

    // ── Command: Check Health ───────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.checkHealth', async () => {
            try {
                const result = await apiRequest('/health');
                const apis = result.apis || {};
                const total = Object.keys(apis).length;
                const healthy = Object.values(apis).filter((a: any) => a.status === 'healthy').length;
                vscode.window.showInformationMessage(`API Health: ${healthy}/${total} healthy`);
            } catch (err) {
                vscode.window.showErrorMessage(`Health check failed: ${err}`);
            }
        })
    );

    // ── Command: CI/CD Gate ─────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.cicdGate', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Open a file to check');
                return;
            }

            const code = editor.document.getText();
            const language = editor.document.languageId;

            vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'DevPulse: Running CI/CD gate...' },
                async () => {
                    try {
                        const result = await apiRequest('/api/cicd/check', 'POST', { code, language });
                        const verdict = result.verdict || 'unknown';
                        const grade = result.grade || 'N/A';
                        const icon = verdict === 'pass' ? '✅' : '❌';
                        vscode.window.showInformationMessage(
                            `${icon} CI/CD Gate: ${verdict.toUpperCase()} (Grade: ${grade})`
                        );
                    } catch (err) {
                        vscode.window.showErrorMessage(`CI/CD gate error: ${err}`);
                    }
                }
            );
        })
    );

    // Status bar item
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = '$(shield) DevPulse';
    statusBar.tooltip = 'DevPulse: AI API Security & Cost Intelligence';
    statusBar.command = 'devpulse.fullSecurityScan';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Cost status bar — shows current cost tracker
    const costBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
    costBar.text = '$(graph) $-.--';
    costBar.tooltip = 'DevPulse: API Cost Tracker (click for dashboard)';
    costBar.command = 'devpulse.showDashboard';
    costBar.show();
    context.subscriptions.push(costBar);

    // Periodically update cost bar (every 5 minutes)
    const updateCostBar = async () => {
        try {
            const costDash = await apiRequest('/api/v1/costs/dashboard');
            const total = costDash?.breakdown?.total ?? costDash?.total_spend ?? 0;
            const formatted = total < 1 ? `$${total.toFixed(4)}` : `$${total.toFixed(2)}`;
            costBar.text = `$(graph) ${formatted}`;
            costBar.tooltip = `DevPulse: Total API spend ${formatted} — click for full dashboard`;
        } catch {
            costBar.text = '$(graph) $-.--';
        }
    };
    updateCostBar();
    const costInterval = setInterval(updateCostBar, 300_000);
    context.subscriptions.push({ dispose: () => clearInterval(costInterval) });

    // ── Command: Show Threat Feed ───────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.showThreatFeed', async () => {
            const panel = vscode.window.createWebviewPanel(
                'devpulseThreatFeed',
                'DevPulse — Threat Intelligence Feed',
                vscode.ViewColumn.One,
                { enableScripts: false }
            );

            try {
                const result = await apiRequest('/api/v1/security/threat-feed');
                const threats: any[] = result.threats || [];
                const rows = threats.map((t: any, i: number) => {
                    const sevColor: Record<string, string> = {
                        critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#3b82f6',
                    };
                    const color = sevColor[t.severity] || '#a1a1aa';
                    return `
                        <div class="card">
                            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                                <span style="background:${color}20;color:${color};border:1px solid ${color}40;padding:1px 8px;border-radius:12px;font-size:10px;font-weight:600;text-transform:uppercase;">${t.severity}</span>
                                <span style="color:#71717a;font-size:10px;">${t.source || ''}</span>
                            </div>
                            <p style="color:#fafafa;font-weight:600;font-size:13px;margin-bottom:4px;">${t.title}</p>
                            <p style="color:#a1a1aa;font-size:12px;margin-bottom:6px;">${t.description}</p>
                            ${t.affected_providers?.length ? `<p style="color:#71717a;font-size:10px;">Affected: ${t.affected_providers.join(', ')}</p>` : ''}
                            ${t.mitigation ? `<div style="background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:8px;margin-top:6px;"><p style="color:#34d399;font-size:10px;font-weight:600;margin-bottom:2px;">MITIGATION</p><p style="color:#d4d4d8;font-size:11px;">${t.mitigation}</p></div>` : ''}
                        </div>`;
                }).join('');

                panel.webview.html = `<!DOCTYPE html>
<html><head><style>
    body { font-family: -apple-system, sans-serif; padding: 16px; background: #09090b; color: #fafafa; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 14px; margin: 8px 0; }
    h1 { color: #f87171; }
</style></head><body>
    <h1>Threat Intelligence Feed</h1>
    <p style="color:#71717a;font-size:12px;margin-bottom:16px;">${threats.length} active threat(s)</p>
    ${rows || '<p style="color:#52525b;">No active threats</p>'}
</body></html>`;
            } catch (err) {
                panel.webview.html = `<html><body style="background:#09090b;color:#fafafa;padding:24px;font-family:sans-serif;"><h2>Failed to load threat feed</h2><p>${err}</p></body></html>`;
            }
        })
    );

    // ── Command: Cost Dashboard ─────────────────────────────────────────────
    context.subscriptions.push(
        vscode.commands.registerCommand('devpulse.costDashboard', async () => {
            const panel = vscode.window.createWebviewPanel(
                'devpulseCostDash',
                'DevPulse — Cost Intelligence',
                vscode.ViewColumn.One,
                { enableScripts: false }
            );

            try {
                const costDash = await apiRequest('/api/v1/costs/dashboard');
                const breakdown = costDash?.breakdown || {};
                const forecast = costDash?.forecast || {};
                const anomalies = costDash?.anomalies || [];
                const tips = costDash?.optimization_tips || [];

                const totalCost = breakdown.total ?? 0;
                const forecastDaily = forecast.forecasted_daily ?? 0;

                const providerRows = Object.entries(breakdown.by_provider || {})
                    .map(([p, c]) => `<tr><td style="padding:4px 8px;color:#e4e4e7;">${p}</td><td style="padding:4px 8px;color:#34d399;text-align:right;">$${(c as number).toFixed(4)}</td></tr>`)
                    .join('') || '<tr><td colspan="2" style="color:#52525b;">No cost data</td></tr>';

                const anomalyRows = anomalies.slice(0, 5).map((a: any) => `
                    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:10px;margin:4px 0;">
                        <span style="color:#f87171;font-weight:600;font-size:12px;">${a.type || 'Anomaly'}</span>
                        <p style="color:#a1a1aa;font-size:11px;margin-top:2px;">${a.description || ''}</p>
                    </div>`).join('') || '<p style="color:#52525b;font-size:12px;">No anomalies detected</p>';

                const tipRows = tips.slice(0, 5).map((t: any) => `
                    <div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:10px;margin:4px 0;">
                        <span style="color:#a78bfa;font-weight:600;font-size:12px;">${t.title || 'Tip'}</span>
                        <p style="color:#a1a1aa;font-size:11px;margin-top:2px;">${t.description || ''}</p>
                        ${t.estimated_monthly_savings_usd ? `<p style="color:#34d399;font-size:10px;margin-top:2px;">Potential savings: $${t.estimated_monthly_savings_usd}/mo</p>` : ''}
                    </div>`).join('') || '<p style="color:#52525b;font-size:12px;">No optimization tips</p>';

                panel.webview.html = `<!DOCTYPE html>
<html><head><style>
    body { font-family: -apple-system, sans-serif; padding: 16px; background: #09090b; color: #fafafa; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 10px 0; }
    h1 { color: #34d399; }
    h3 { color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat { font-size: 28px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
</style></head><body>
    <h1>Cost Intelligence Dashboard</h1>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div class="card">
            <h3>Total Spend</h3>
            <p class="stat" style="color:#34d399;">$${totalCost.toFixed(2)}</p>
        </div>
        <div class="card">
            <h3>Daily Forecast</h3>
            <p class="stat" style="color:#a78bfa;">$${forecastDaily.toFixed(4)}</p>
        </div>
    </div>
    <div class="card">
        <h3>Cost by Provider</h3>
        <table>${providerRows}</table>
    </div>
    <div class="card">
        <h3>Anomalies</h3>
        ${anomalyRows}
    </div>
    <div class="card">
        <h3>Optimization Tips</h3>
        ${tipRows}
    </div>
    <div style="text-align:center;color:#52525b;font-size:11px;margin-top:16px;">DevPulse v4.0 · Cost Intelligence</div>
</body></html>`;
            } catch (err) {
                panel.webview.html = `<html><body style="background:#09090b;color:#fafafa;padding:24px;font-family:sans-serif;"><h2>Failed to load cost dashboard</h2><p>${err}</p></body></html>`;
            }
        })
    );
}

// ── Dashboard HTML ───────────────────────────────────────────────────────────
function getDashboardHtml(health: any, dashboard: any, costDash: any): string {
    const apis = health?.apis || {};
    const apiList = Object.entries(apis)
        .map(([name, info]: [string, any]) => {
            const color = info.status === 'healthy' ? '#10b981' : '#ef4444';
            return `<li style="padding:4px 0;"><span style="color:${color}">●</span> ${name} – ${info.latency_ms || 0}ms</li>`;
        })
        .join('');

    const breakdown = costDash?.breakdown || {};
    const forecast = costDash?.forecast || {};
    const totalCost = breakdown.total ?? 0;
    const forecastDaily = forecast.forecasted_daily ?? 0;

    const providerList = Object.entries(breakdown.by_provider || {})
        .map(([provider, cost]) => `<li style="padding:2px 0;">${provider}: $${(cost as number).toFixed(4)}</li>`)
        .join('') || '<li>No cost data</li>';

    return `<!DOCTYPE html>
<html>
<head><style>
    body { font-family: -apple-system, sans-serif; padding: 16px; background: #09090b; color: #fafafa; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 8px 0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    h1 { background: linear-gradient(to right, #ef4444, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    h3 { color: #a1a1aa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    .stat { font-size: 24px; font-weight: bold; }
    .label { font-size: 11px; color: #71717a; }
    ul { list-style: none; padding: 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-red { background: rgba(239,68,68,0.15); color: #f87171; }
    .badge-green { background: rgba(16,185,129,0.15); color: #34d399; }
</style></head>
<body>
    <h1>🛡️ DevPulse — Security & Cost Dashboard</h1>
    <span class="badge badge-red">v4.0</span>

    <div class="grid">
        <div class="card">
            <h3>API Overview</h3>
            <p class="stat">${dashboard?.total_apis || 0}</p>
            <p class="label">Total APIs Monitored</p>
            <p style="margin-top:8px;">${dashboard?.healthy_apis || 0} healthy · ${(dashboard?.uptime_percentage || 0).toFixed(1)}% uptime</p>
        </div>
        <div class="card">
            <h3>Cost Intelligence</h3>
            <p class="stat">$${totalCost.toFixed(2)}</p>
            <p class="label">Total Spend (Period)</p>
            <p style="margin-top:8px;">Forecast: $${forecastDaily.toFixed(4)}/day</p>
        </div>
    </div>

    <div class="card">
        <h3>Cost by Provider</h3>
        <ul>${providerList}</ul>
    </div>

    <div class="card">
        <h3>API Status</h3>
        <ul>${apiList || '<li>No APIs monitored</li>'}</ul>
    </div>

    <div class="card" style="text-align:center; color:#52525b; font-size:11px;">
        DevPulse v4.0 · AI API Security & Cost Intelligence Platform
    </div>
</body>
</html>`;
}

// ── Fix Suggestions HTML ─────────────────────────────────────────────────────
function getFixSuggestionsHtml(suggestions: any[], aiPowered: boolean): string {
    const suggestionCards = suggestions.map((s: any, i: number) => `
        <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;color:#f87171;">Issue ${i + 1}</span>
                <span class="badge ${s.severity === 'high' || s.severity === 'critical' ? 'badge-red' : 'badge-yellow'}">${s.severity || 'medium'}</span>
            </div>
            <p style="color:#e4e4e7;margin-bottom:8px;">${s.description || s.issue || 'Security issue detected'}</p>
            <div style="background:#0a0a0a;border:1px solid #27272a;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;color:#a78bfa;white-space:pre-wrap;">${s.fix || s.suggestion || 'Use environment variables instead of hardcoded secrets'}</div>
        </div>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head><style>
    body { font-family: -apple-system, sans-serif; padding: 16px; background: #09090b; color: #fafafa; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 8px 0; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-red { background: rgba(239,68,68,0.15); color: #f87171; }
    .badge-yellow { background: rgba(234,179,8,0.15); color: #facc15; }
    h1 { color: #a78bfa; }
</style></head>
<body>
    <h1>🔧 AI Fix Suggestions</h1>
    <p style="color:#71717a;font-size:12px;margin-bottom:16px;">${aiPowered ? '🤖 Powered by Groq LLM' : '📋 Static analysis'} · ${suggestions.length} suggestion(s)</p>
    ${suggestionCards}
</body>
</html>`;
}

export function deactivate() {}
