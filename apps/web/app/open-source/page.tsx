"use client";

import { useState } from "react";
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
    {
      name: "Next.js",
      desc: "React framework used by the RaksHex web application.",
      url: "https://nextjs.org",
    },
    {
      name: "Express + tRPC",
      desc: "HTTP server and typed application API used by apps/api.",
      url: "https://trpc.io",
    },
    {
      name: "Drizzle ORM",
      desc: "Typed database schema/query layer used with PostgreSQL.",
      url: "https://orm.drizzle.team",
    },
    {
      name: "PostgreSQL",
      desc: "The durable relational database supported by RaksHex.",
      url: "https://www.postgresql.org",
    },
    {
      name: "Redis + BullMQ",
      desc: "Low-latency control/cache state and asynchronous queue processing.",
      url: "https://bullmq.io",
    },
    {
      name: "Vitest + Playwright",
      desc: "Unit/integration and browser smoke-test foundations in the release gate.",
      url: "https://playwright.dev",
    },
  ];

  return (
    <div className="min-h-screen bg-transparent text-slate-100 py-24 px-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-400 border border-blue-900/60 mb-4">
            🔒 Built on Open Standards
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
            Open Source Strategy
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg mt-3">
            Inspect the public source, follow the release evidence, file issues, and evaluate exactly
            what the current RaksHex code implements.
          </p>
        </header>

        <section className="bg-slate-900/40 border border-slate-900 rounded-xl p-8 mb-12 text-center md:text-left md:flex md:items-center md:justify-between gap-8">
          <div className="max-w-xl mb-6 md:mb-0">
            <h2 className="text-2xl font-bold text-white mb-3">
              Planned: separately packaged detection rules
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              The current monorepo already contains scanner and policy source. We may also publish
              selected detection/policy material in a separately consumable form. Join the waitlist
              if you want an update when that packaging is actually available.
            </p>
          </div>
          <div className="flex-shrink-0 w-full md:w-80">
            {success ? (
              <div className="bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-center text-sm font-medium">
                ✓ You&apos;re on the list. We&apos;ll notify you when there is a real release to share.
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
                  disabled={joinMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  {joinMutation.isPending ? "Joining..." : "Join Release Waitlist"}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="bg-gradient-to-br from-slate-900/60 to-slate-950 border border-slate-800/80 rounded-xl p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Source and issues on GitHub</h2>
            <p className="text-sm text-slate-400 max-w-xl">
              Review the current monorepo, inspect implementation details, and file reproducible bug
              reports against the repository that actually contains this product.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <a
              href="https://github.com/Akshu1245/Rakshex-complete-codebase/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none text-center px-4 py-2 border border-slate-700 hover:bg-slate-900 text-slate-200 font-semibold text-sm rounded-lg transition-colors"
            >
              Issues
            </a>
            <a
              href="https://github.com/Akshu1245/Rakshex-complete-codebase"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none text-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm rounded-lg transition-colors shadow-md shadow-white/5"
            >
              View Repository
            </a>
          </div>
        </section>

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
                  <span className="font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                    {tech.name}
                  </span>
                  <span className="text-slate-600 text-xs">→</span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{tech.desc}</p>
              </a>
            ))}
          </div>
        </section>

        <footer className="border-t border-slate-900 pt-8 text-center text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} RaksHex. Repository availability does not imply every
            roadmap integration or external service is publicly released.
          </p>
        </footer>
      </div>
    </div>
  );
}
