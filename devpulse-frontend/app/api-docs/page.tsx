"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BookOpen,
  Search,
  Globe,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Check,
  Zap,
} from "lucide-react";
import Link from "next/link";

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    get: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    post: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    patch: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    delete: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
        colors[method.toLowerCase()] || "bg-surface-container text-on-surface-variant border-glass"
      }`}
    >
      {method.toUpperCase()}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="p-1.5 rounded-md hover:bg-surface-container-low transition-colors text-on-surface-variant"
      title="Copy"
    >
      {copied ? <Check className="w-4 h-4 text-status-success" /> : <Copy className="w-4 h-4" />}
    </button>
  );
}

export default function ApiDocsPage() {
  const [search, setSearch] = useState("");
  const [expandedTags, setExpandedTags] = useState<Set<string>>(new Set());
  const [showAuthOnly, setShowAuthOnly] = useState(false);

  const summaryQuery = trpc.apiDocs.summary.useQuery();
  const specQuery = trpc.apiDocs.spec.useQuery(undefined, { staleTime: 60_000 });

  const summary = summaryQuery.data;
  const spec = specQuery.data;

  const grouped = useMemo(() => {
    if (!spec?.paths) return [];
    const byTag = new Map<string, { method: string; path: string; op: any }[]>();
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const tag = op.tags?.[0] ?? "general";
        const list = byTag.get(tag) ?? [];
        list.push({ method, path, op });
        byTag.set(tag, list);
      }
    }
    return Array.from(byTag.entries())
      .map(([tag, ops]) => ({ tag, ops }))
      .sort((a, b) => b.ops.length - a.ops.length);
  }, [spec]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return grouped
      .map(({ tag, ops }) => ({
        tag,
        ops: ops.filter(
          (o) =>
            (!q ||
              o.path.toLowerCase().includes(q) ||
              o.op.summary?.toLowerCase().includes(q) ||
              o.op.operationId?.toLowerCase().includes(q)) &&
            (!showAuthOnly || o.op.security?.length > 0),
        ),
      }))
      .filter((g) => g.ops.length > 0);
  }, [grouped, search, showAuthOnly]);

  const toggleTag = (tag: string) => {
    setExpandedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  if (summaryQuery.isLoading || specQuery.isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-on-surface-variant font-label-mono">Loading API docs…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <div className="border-b border-glass bg-surface-container-lowest/60 backdrop-blur-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md text-white font-bold">API Docs</h1>
              <p className="text-xs text-on-surface-variant font-label-mono">
                {summary?.totalProcedures ?? 0} procedures across {summary?.domains?.length ?? 0}{" "}
                domains
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="px-3 py-2 text-sm font-medium text-on-surface-variant hover:text-white transition-colors"
            >
              Back to App
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search + Filters */}
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints, methods, or descriptions…"
              className="w-full pl-10 pr-4 py-2.5 bg-surface-container border border-glass rounded-xl text-sm text-white placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowAuthOnly((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
              showAuthOnly
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-surface-container border-glass text-on-surface-variant hover:text-white"
            }`}
          >
            {showAuthOnly ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            {showAuthOnly ? "Auth Only" : "All Endpoints"}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {summary?.domains?.slice(0, 4).map((d: any) => (
            <div key={d.tag} className="glass-card p-4">
              <p className="text-[10px] font-label-mono text-on-surface-variant uppercase tracking-wider">
                {d.tag}
              </p>
              <p className="text-2xl font-bold text-white mt-1">{d.queries + d.mutations}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold">
                  {d.queries} Q
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                  {d.mutations} M
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Endpoints */}
        <div className="flex flex-col gap-6">
          {filtered.length === 0 && (
            <div className="glass-card p-12 text-center">
              <Globe className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-3" />
              <p className="text-white font-semibold">No endpoints match your search</p>
              <p className="text-sm text-on-surface-variant mt-1">
                Try a different query or clear filters.
              </p>
            </div>
          )}

          {filtered.map(({ tag, ops }) => {
            const isOpen = expandedTags.has(tag) || search.length > 0;
            return (
              <div key={tag} className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleTag(tag)}
                  className="w-full flex items-center justify-between p-5 hover:bg-surface-container-low/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Code2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-white capitalize">{tag}</span>
                    <span className="px-2 py-0.5 rounded-full bg-surface-container text-[10px] font-label-mono text-on-surface-variant border border-glass">
                      {ops.length}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-on-surface-variant" />
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-glass">
                    {ops.map(({ method, path, op }) => {
                      const isAuth = op.security?.length > 0;
                      const curl = `curl -X ${method.toUpperCase()} "${spec?.servers?.[0]?.url ?? ""}${path}"${
                        isAuth ? ' -H "Authorization: Bearer <token>"' : ""
                      }`;
                      return (
                        <div
                          key={`${method}-${path}`}
                          className="p-4 border-b border-glass last:border-b-0 hover:bg-surface-container-low/20 transition-colors"
                        >
                          <div className="flex items-start gap-3 flex-wrap">
                            <MethodBadge method={method} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-mono text-primary">{path}</span>
                                {isAuth && (
                                  <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold uppercase">
                                    <Lock className="w-3 h-3" />
                                    Auth
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-on-surface-variant mt-1">
                                {op.summary || op.description || op.operationId}
                              </p>
                            </div>
                            <CopyButton text={curl} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-12 p-6 glass-card border border-glass text-center">
          <Zap className="w-6 h-6 text-primary mx-auto mb-2" />
          <p className="text-sm text-white font-medium">Want to integrate programmatically?</p>
          <p className="text-xs text-on-surface-variant mt-1 max-w-lg mx-auto">
            Every procedure is JSON-over-HTTP. Queries (GET) take input as a URL-encoded JSON
            parameter; mutations (POST) take JSON request bodies. Auth is via session cookie issued
            by{" "}
            <code className="px-1 py-0.5 bg-surface-container rounded text-primary font-mono text-xs">
              /auth/login
            </code>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
