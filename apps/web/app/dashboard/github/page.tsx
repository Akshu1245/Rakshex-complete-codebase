"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

/** Explicit local-only sandbox. Never enabled by NODE_ENV alone. */
const SANDBOX_MODE = process.env.NEXT_PUBLIC_SANDBOX_MODE === "true";

export default function GitHubIntegrationPage() {
  const [installationId, setInstallationId] = useState("");
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [repoFullName, setRepoFullName] = useState("");
  const [prNumber, setPrNumber] = useState("");
  const [headSha, setHeadSha] = useState("");

  const connectMutation = trpc.github.connectInstallation.useMutation();
  const installUrlQuery = trpc.github.getInstallUrl.useQuery();
  const listReposQuery = trpc.github.listRepos.useQuery(
    { installationId: Number(installationId) || 0 },
    { enabled: Number(installationId) > 0 },
  );

  const installUrl = installUrlQuery.data?.installUrl;

  const handleManualConnect = async () => {
    if (!installationId) return;
    setConnectionError(null);
    try {
      await connectMutation.mutateAsync({
        installationId: Number(installationId),
        accountLogin: "manual-connect",
        accountType: "User",
      });
    } catch {
      setConnectionError(
        "Could not link this installation. Verify the installation ID and access.",
      );
    }
  };

  const handleTriggerPRScan = async (repoOverride?: string) => {
    const id = Number(installationId);
    const repo = repoOverride || repoFullName.trim();
    const pr = Number(prNumber);
    if (!id) {
      alert("Enter a GitHub App installation ID first");
      return;
    }
    if (!repo || !pr) {
      alert("Enter the repository (owner/repo) and PR number to scan");
      return;
    }
    try {
      const result = await (trpc as any).github.scanPullRequest.mutate({
        installationId: id,
        repoFullName: repo,
        prNumber: pr,
        headSha: headSha.trim() || undefined,
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
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Connect GitHub App</h2>
            <p className="text-gray-400 mb-4">
              Install the RakshEx GitHub App on your organization or account, then paste the
              installation ID below to link it to your workspace.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => {
                  if (installUrl) {
                    window.open(installUrl, "_blank");
                  } else {
                    setConnectionError(
                      "GitHub App is not configured (set GITHUB_APP_SLUG or GITHUB_APP_ID).",
                    );
                  }
                }}
                disabled={!installUrl && !installUrlQuery.isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                Install GitHub App
              </button>
            </div>
            {!installUrl && !installUrlQuery.isLoading ? (
              <p className="text-xs text-amber-500/80 mt-2">
                Set GITHUB_APP_SLUG (or GITHUB_APP_ID) on the API to enable the live install link.
              </p>
            ) : null}
            {SANDBOX_MODE ? (
              <p className="text-xs text-amber-500/80 mt-2">
                NEXT_PUBLIC_SANDBOX_MODE is on — use only for local demos. Production builds must
                leave this unset.
              </p>
            ) : null}
          </div>

          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Connected Repositories</h2>

            <div className="flex gap-2 mb-4 flex-wrap">
              <input
                type="text"
                placeholder="Installation ID from GitHub App settings"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
                className="flex-1 min-w-[200px] max-w-xs px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
              <button
                onClick={handleManualConnect}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded"
              >
                Link
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <input
                type="text"
                placeholder="owner/repo"
                value={repoFullName}
                onChange={(e) => setRepoFullName(e.target.value)}
                className="px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
              <input
                type="number"
                placeholder="PR number"
                value={prNumber}
                onChange={(e) => setPrNumber(e.target.value)}
                className="px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
              <input
                type="text"
                placeholder="Head SHA (optional)"
                value={headSha}
                onChange={(e) => setHeadSha(e.target.value)}
                className="px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
            </div>
            <button
              onClick={() => handleTriggerPRScan()}
              disabled={!installationId || !repoFullName || !prNumber}
              className="px-4 py-2 mb-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded"
            >
              Trigger PR Scan
            </button>

            {connectionError && (
              <p role="alert" className="mb-4 text-sm text-red-300">
                {connectionError}
              </p>
            )}

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
                          setRepoFullName(repo.fullName || String(repo));
                        }}
                        className="text-xs px-3 py-1 bg-blue-900/50 hover:bg-blue-800 rounded border border-blue-700"
                      >
                        Use for PR scan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                No repos yet. Install the GitHub App and enter a real installation ID above.
              </p>
            )}
          </div>

          <div className="bg-black/30 p-6 rounded-lg border border-gray-800 text-sm text-gray-400">
            <h3 className="font-semibold text-white mb-2">How PR scanning works</h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>Install the RakshEx GitHub App and link the installation ID</li>
              <li>On PR open or new commits → webhook → queue → worker</li>
              <li>
                Real secret scanning (AWS, GitHub, OpenAI, private keys, JWTs…) + extra heuristics
              </li>
              <li>Detailed findings posted as a rich comment on the PR</li>
              <li>Results also appear in your RakshEx dashboard</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
