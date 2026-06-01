"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";

export default function GitHubIntegrationPage() {
  const [installationId, setInstallationId] = useState("");

  const connectMutation = trpc.github.connectInstallation.useMutation();
  const listReposQuery = trpc.github.listRepos.useQuery(
    { installationId: Number(installationId) || 0 },
    { enabled: Number(installationId) > 0 },
  );

  const handleConnect = async () => {
    // In production, this would redirect to GitHub App install flow
    const clientId = "YOUR_GITHUB_APP_CLIENT_ID";
    window.location.href = `https://github.com/apps/RaksHex-security/installations/new`;
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">GitHub Integration</h1>
            <p className="text-gray-400 mt-1">
              Connect repositories for automated PR security scans
            </p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            &larr; Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Connect card */}
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">GitHub App Connection</h2>
            <p className="text-gray-400 mb-4">
              Install the RaksHex GitHub App to enable automatic PR security scans. Findings are
              posted as comments on each pull request.
            </p>
            <button
              onClick={handleConnect}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors border border-gray-600"
            >
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                Install GitHub App
              </span>
            </button>
          </div>

          {/* Repos list */}
          <div className="bg-black/50 p-6 rounded-lg border border-gray-700">
            <h2 className="text-xl font-semibold mb-4">Connected Repositories</h2>
            <div className="mb-4">
              <input
                type="number"
                placeholder="Installation ID"
                value={installationId}
                onChange={(e) => setInstallationId(e.target.value)}
                className="w-full max-w-xs px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white"
              />
            </div>
            {listReposQuery.data ? (
              <div className="space-y-2">
                {listReposQuery.data.repos.map((repo: any) => (
                  <div
                    key={repo.fullName}
                    className="flex items-center justify-between p-3 bg-gray-750 rounded border border-gray-700"
                  >
                    <span className="text-gray-200">{repo.fullName}</span>
                    <span
                      className={`text-xs px-2 py-1 rounded ${repo.private ? "bg-yellow-900/50 text-yellow-400" : "bg-green-900/50 text-green-400"}`}
                    >
                      {repo.private ? "Private" : "Public"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">
                Connect a GitHub App installation to see repositories here.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
