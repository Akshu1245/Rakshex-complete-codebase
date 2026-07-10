"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

const SANDBOX_MODE =
  process.env.NEXT_PUBLIC_SANDBOX_MODE === "true" || process.env.NODE_ENV !== "production";

export default function GitHubIntegrationPage() {
  const [installationId, setInstallationId] = useState("");

  const connectMutation = trpc.github.connectInstallation.useMutation();
  const listReposQuery = trpc.github.listRepos.useQuery(
    { installationId: Number(installationId) || 0 },
    { enabled: Number(installationId) > 0 },
  );

  const handleConnect = async () => {
    if (!SANDBOX_MODE) {
      window.open("https://github.com/apps", "_blank");
      return;
    }
    const sandboxId = 900001;
    try {
      await connectMutation.mutateAsync({
        installationId: sandboxId,
        accountLogin: "sandbox-org",
        accountType: "Organization",
      });
      setInstallationId(String(sandboxId));
    } catch {
      setInstallationId(String(sandboxId));
    }
  };

  const handleManualConnect = async () => {
    if (!installationId) return;
    try {
      await connectMutation.mutateAsync({
        installationId: Number(installationId),
        accountLogin: "manual-connect",
        accountType: "User",
      });
    } catch {}
  };

  const handleTriggerPRScan = async () => {
    const id = Number(installationId);
    if (!id) {
      alert("Connect an installation or enter an ID first");
      return;
    }
    try {
      const result = await (trpc as any).github.scanPullRequest.mutate({
        installationId: id,
        repoFullName: "demo-org/api-service",
        prNumber: 42,
        headSha: "HEAD",
      });
      alert(`PR scan job queued successfully! (jobId: ${result?.jobId ?? "pending"})`);
    } catch {
      alert("Failed to queue PR scan. Check your GitHub App installation and try again.");
    }
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">GitHub Integration</h1>
            <p className="text-gray-400 mt-1">
              Connect repositories for automated PR security scans. Findings are posted directly as
              PR comments.
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Connect */}
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Connect GitHub App</h2>
            <p className="text-gray-400 mb-4">
              Install the DevPulse GitHub App on your organization or account to enable automatic
              scanning on every PR.
            </p>
            <div className="flex gap-3 flex-wrap">
              {SANDBOX_MODE ? (
                <button
                  onClick={handleConnect}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  Connect Sandbox Installation
                </button>
              ) : null}
              <button
                onClick={() => window.open("https://github.com/apps", "_blank")}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium border border-gray-600"
              >
                Install GitHub App
              </button>
            </div>
            {SANDBOX_MODE ? (
              <p className="text-xs text-amber-500/80 mt-2">
                Sandbox mode enabled — uses test installation for local demos only.
              </p>
            ) : null}
          </div>

          {/* Manual ID + Repos */}
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Connected Repositories</h2>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Installation ID from GitHub App settings"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
                className="flex-1 max-w-xs px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
              <button
                onClick={handleManualConnect}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Link
              </button>
              <button
                onClick={handleTriggerPRScan}
                disabled={!installationId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded"
              >
                Trigger Test PR Scan
              </button>
            </div>

            {listReposQuery.isLoading ? (
              <p className="text-gray-400">Loading repos...</p>
            ) : listReposQuery.data?.repos?.length ? (
              <div className="space-y-2">
                {listReposQuery.data.repos.map((repo: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-gray-800/70 rounded border border-gray-700"
                  >
                    <div>
                      <span className="text-gray-100 font-mono">{repo.fullName || repo}</span>
                      {repo.defaultBranch && (
                        <span className="text-xs ml-2 text-gray-500">({repo.defaultBranch})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded ${repo.private ? "bg-yellow-900/60 text-yellow-400" : "bg-green-900/60 text-green-400"}`}
                      >
                        {repo.private ? "Private" : "Public"}
                      </span>
                      <button
                        onClick={() => {
                          setInstallationId(String(installationId));
                          handleTriggerPRScan();
                        }}
                        className="text-xs px-3 py-1 bg-blue-900/50 hover:bg-blue-800 rounded border border-blue-700"
                      >
                        Scan latest PR
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No repos yet. Click “Connect Demo Installation” or enter an installation ID above.
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="bg-black/30 p-6 rounded-lg border border-gray-800 text-sm text-gray-400">
            <h3 className="font-semibold text-white mb-2">How PR scanning works</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Install the DevPulse GitHub App (or use demo)</li>
              <li>On PR open or new commits → webhook → queue → worker</li>
              <li>
                Real secret scanning (AWS, GitHub, OpenAI, private keys, JWTs…) + extra heuristics
              </li>
              <li>Detailed findings posted as a rich comment on the PR</li>
              <li>Results also appear in your DevPulse dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
