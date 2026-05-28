"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/Toast";

export default function OpenSourcePage() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const joinMutation = trpc.waitlist.join.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError(null);
      addToast("success", "Successfully joined the open-source waitlist!");
    },
    onError: (err) => {
      setError(err.message || "Failed to join waitlist. Please try again.");
      addToast("error", err.message || "Subscription failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    joinMutation.mutate({
      email,
      plan: "Free",
      source: "open_source_waitlist",
    });
  };

  const attributions = [
    { name: "Next.js", desc: "Production grade React framework for server rendering and routing.", url: "https://nextjs.org" },
    { name: "tRPC", desc: "End-to-end typesafe APIs made simple without schemas.", url: "https://trpc.io" },
    { name: "Drizzle ORM", desc: "Next-gen TypeScript ORM with database-first feel.", url: "https://orm.drizzle.team" },
    { name: "Fastify / Express", desc: "High-performance web frameworks for backend API routing.", url: "https://fastify.dev" },
    { name: "PostgreSQL & MySQL", desc: "Robust open-source relational databases.", url: "https://www.postgresql.org" },
    { name: "Redis", desc: "In-memory caching and session rate limiting engine.", url: "https://redis.io" },
    { name: "shadcn/ui", desc: "Beautifully designed accessible UI component primitives.", url: "https://ui.shadcn.com" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-16 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/60 mb-4">
            🔒 Built on Open Standards
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Open Source Strategy
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg mt-3">
            Transparency is foundational to runtime governance. Audit our tech stack, view our repositories, and participate in our open-source journey.
          </p>
        </header>

        {/* Planned Open Source Statement */}
        <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-8 mb-12 text-center md:text-left md:flex md:items-center md:justify-between gap-8">
          <div className="max-w-xl mb-6 md:mb-0">
            <h2 className="text-2xl font-bold text-white mb-3">Planned: OWASP AI Top 10 Detection Ruleset</h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              We are planning to open source our core signature rules and detection heuristics for the OWASP AI Top 10 security audits. This allows teams to audit prompt injection models and egress filters locally. Join the waitlist to be notified when the repository opens.
            </p>
          </div>
          <div className="flex-shrink-0 w-full md:w-80">
            {success ? (
              <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-center text-sm font-medium">
                ✓ You're on the list! We will notify you at launch.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  required
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500 placeholder-gray-500"
                />
                {error && <p className="text-xs text-rose-400">{error}</p>}
                <button
                  type="submit"
                  disabled={joinMutation.isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  {joinMutation.isLoading ? "Joining..." : "Join Ruleset Waitlist"}
                </button>
              </form>
            )}
          </div>
        </section>

        {/* GitHub Contribution CTA */}
        <section className="bg-gradient-to-br from-slate-900/60 to-slate-950 border border-slate-800/80 rounded-2xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Contribute on GitHub</h2>
            <p className="text-sm text-slate-400 max-w-xl">
              Help us build the next generation of security firewalls. Star our organization, file bug reports, or check our open discussions.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <a
              href="https://github.com/rakshex-hq/rakshex/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none text-center px-4 py-2 border border-slate-700 hover:bg-slate-900 text-slate-200 font-semibold text-sm rounded-lg transition-colors"
            >
              Contribute / Issues
            </a>
            <a
              href="https://github.com/rakshex-hq/rakshex"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none text-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm rounded-lg transition-colors shadow-md shadow-white/5"
            >
              ★ Star on GitHub
            </a>
          </div>
        </section>

        {/* Attributions / Stack */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Open Source Foundations</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {attributions.map((tech) => (
              <a
                key={tech.name}
                href={tech.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-slate-900/30 border border-slate-900 hover:border-slate-850 hover:bg-slate-900/50 p-5 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-blue-400 group-hover:text-blue-300 transition-colors">{tech.name}</span>
                  <span className="text-slate-600 text-xs">→</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{tech.desc}</p>
              </a>
            ))}
          </div>
        </section>

        {/* Mit license */}
        <footer className="border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} RakshEx. Built with pride under open standards and modern developer tools.</p>
        </footer>
      </div>
    </div>
  );
}
