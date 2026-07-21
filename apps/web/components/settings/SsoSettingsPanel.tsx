"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/Toast";
import { EmptyState } from "@/components/EmptyState";

type ProviderKind = "oidc" | "saml";

const inputClass =
  "w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm";

export function SsoSettingsPanel() {
  const { addToast } = useToast();
  const utils = trpc.useUtils();
  const listQuery = trpc.sso.listProviders.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<ProviderKind>("oidc");
  const [name, setName] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [defaultRole, setDefaultRole] = useState<"admin" | "editor" | "viewer">("viewer");

  // OIDC
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  // SAML
  const [entryPoint, setEntryPoint] = useState("");
  const [samlIssuer, setSamlIssuer] = useState("");
  const [audience, setAudience] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("");

  const createProvider = trpc.sso.createProvider.useMutation({
    onSuccess: () => {
      utils.sso.listProviders.invalidate();
      setShowForm(false);
      resetForm();
      addToast("success", "SSO provider created (disabled until you enable it)");
    },
    onError: (err) => addToast("error", err.message),
  });

  const setEnabled = trpc.sso.setEnabled.useMutation({
    onSuccess: () => {
      utils.sso.listProviders.invalidate();
      addToast("success", "SSO provider updated");
    },
    onError: (err) => addToast("error", err.message),
  });

  const deleteProvider = trpc.sso.deleteProvider.useMutation({
    onSuccess: () => {
      utils.sso.listProviders.invalidate();
      addToast("success", "SSO provider removed");
    },
    onError: (err) => addToast("error", err.message),
  });

  const resetForm = () => {
    setName("");
    setEmailDomain("");
    setDefaultRole("viewer");
    setIssuer("");
    setClientId("");
    setClientSecret("");
    setEntryPoint("");
    setSamlIssuer("");
    setAudience("");
    setCallbackUrl("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "oidc") {
      createProvider.mutate({
        name,
        kind: "oidc",
        emailDomain: emailDomain || undefined,
        defaultRole,
        config: { issuer, clientId, clientSecret },
      });
    } else {
      createProvider.mutate({
        name,
        kind: "saml",
        emailDomain: emailDomain || undefined,
        defaultRole,
        config: {
          entryPoint,
          issuer: samlIssuer,
          audience,
          callbackUrl,
        },
      });
    }
  };

  const providers = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium text-white">Single Sign-On</h3>
          <p className="text-sm text-gray-400 mt-1">
            Configure OIDC or SAML providers for your workspace. New providers start disabled —
            enable after verifying IdP settings.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
        >
          {showForm ? "Cancel" : "Add provider"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-4 p-4 border border-gray-600 rounded-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={192}
                placeholder="Okta Production"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
              <select
                className={inputClass}
                value={kind}
                onChange={(e) => setKind(e.target.value as ProviderKind)}
              >
                <option value="oidc">OIDC</option>
                <option value="saml">SAML</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email domain (regex)
              </label>
              <input
                className={inputClass}
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                placeholder="@acme\\.com$"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Default role</label>
              <select
                className={inputClass}
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as typeof defaultRole)}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {kind === "oidc" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Issuer URL</label>
                <input
                  className={inputClass}
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                  required
                  type="url"
                  placeholder="https://login.example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Client ID</label>
                <input
                  className={inputClass}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Client secret
                </label>
                <input
                  className={inputClass}
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  required
                  type="password"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Entry point</label>
                <input
                  className={inputClass}
                  value={entryPoint}
                  onChange={(e) => setEntryPoint(e.target.value)}
                  required
                  type="url"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Issuer</label>
                <input
                  className={inputClass}
                  value={samlIssuer}
                  onChange={(e) => setSamlIssuer(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Audience</label>
                <input
                  className={inputClass}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-1">Callback URL</label>
                <input
                  className={inputClass}
                  value={callbackUrl}
                  onChange={(e) => setCallbackUrl(e.target.value)}
                  required
                  type="url"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={createProvider.isPending}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {createProvider.isPending ? "Saving…" : "Create provider"}
          </button>
        </form>
      )}

      {listQuery.isLoading ? (
        <p className="text-sm text-gray-400">Loading providers…</p>
      ) : providers.length === 0 ? (
        <EmptyState
          compact
          title="No SSO providers"
          description="Add an OIDC or SAML provider to let teammates sign in with your IdP."
        />
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-700/50 rounded-md border border-gray-600"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium">{p.name}</span>
                  <span className="text-xs uppercase px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                    {p.kind}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      p.enabled
                        ? "bg-green-900/40 text-green-400"
                        : "bg-yellow-900/40 text-yellow-400"
                    }`}
                  >
                    {p.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Domain: {p.emailDomain || "—"} · Default role: {p.defaultRole}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={setEnabled.isPending}
                  onClick={() => setEnabled.mutate({ id: p.id, enabled: !p.enabled })}
                  className="text-sm px-3 py-1.5 rounded-md border border-gray-500 text-gray-200 hover:bg-gray-600"
                >
                  {p.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={deleteProvider.isPending}
                  onClick={() => {
                    if (confirm(`Remove SSO provider "${p.name}"?`)) {
                      deleteProvider.mutate({ id: p.id });
                    }
                  }}
                  className="text-sm px-3 py-1.5 rounded-md text-red-400 hover:bg-red-900/30"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
