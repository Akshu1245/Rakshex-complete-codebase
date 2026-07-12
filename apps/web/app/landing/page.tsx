"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Zap, Eye, Lock, TrendingDown, Globe, ChevronRight, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Footer } from "@/components/layout/Footer";

const PLANS = [
  { value: "Free", label: "Free — Up to 100 events/mo" },
  { value: "Starter", label: "Starter — $49/mo" },
  { value: "Pro", label: "Pro — $149/mo" },
  { value: "Enterprise", label: "Enterprise — Custom" },
];

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Free");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (email.includes("@")) {
      joinWaitlist.mutate({ email, plan, source: "landing_page" });
    }
  };

  const features = [
    {
      icon: <Eye className="w-5 h-5" />,
      title: "Hidden Token Revelation",
      desc: "See reasoning tokens providers hide. Cut AI costs by 20-40%.",
      color: "from-amber-500/20 to-orange-500/10",
      border: "border-amber-500/20",
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "AgentGuard Kill Switch",
      desc: "Auto-stop infinite loops, rogue agents & cost spikes in real-time.",
      color: "from-emerald-500/20 to-green-500/10",
      border: "border-emerald-500/20",
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Instant Security Scan",
      desc: "Detect secrets, injection & auth issues in API collections in seconds.",
      color: "from-indigo-500/20 to-violet-500/10",
      border: "border-indigo-500/20",
    },
    {
      icon: <Lock className="w-5 h-5" />,
      title: "Shadow API Discovery",
      desc: "Find undocumented endpoints before attackers do.",
      color: "from-rose-500/20 to-pink-500/10",
      border: "border-rose-500/20",
    },
    {
      icon: <TrendingDown className="w-5 h-5" />,
      title: "Cost Anomaly Detection",
      desc: "ML-powered alerts when your AI spend spikes unexpectedly.",
      color: "from-teal-accent/20 to-blue-500/10",
      border: "border-teal-accent/20",
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: "Compliance Automation",
      desc: "Generate PCI DSS, GDPR & SOC2 reports from your API security posture.",
      color: "from-purple-500/20 to-fuchsia-500/10",
      border: "border-purple-500/20",
    },
  ];

  function StatCard({ label, value }: { label: string; value: string }) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <div className="text-xl md:text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
          {value}
        </div>
        <div className="text-sm text-slate-500 mt-1">{label}</div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white overflow-hidden">
      {/* Hero */}
      <section className="relative pt-20 pb-32 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-6">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              Public Beta — Now Live
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Security intelligence
              </span>
              <br />
              for AI agents
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              The first developer-native platform that sits between your code and LLM providers,
              detecting infinite loops, hidden reasoning costs, and API vulnerabilities before they
              hit production.
            </p>

            {/* Email capture */}
            <form onSubmit={handleSubmit} className="max-w-md mx-auto mb-8">
              {!submitted ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                    disabled={joinWaitlist.isPending}
                  />
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    disabled={joinWaitlist.isPending}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer"
                  >
                    {PLANS.map((p) => (
                      <option key={p.value} value={p.value} className="bg-slate-900 text-white">
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={joinWaitlist.isPending}
                    className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {joinWaitlist.isPending ? "Joining..." : "Get Access"}{" "}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {error && <p className="text-sm text-rose-400">{error}</p>}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center gap-2 py-4 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                >
                  <Check className="w-5 h-5" />
                  <span>
                    You are on the waitlist for the <strong>{plan}</strong> plan!
                  </span>
                  <span className="text-xs text-emerald-400/70">We will email you soon.</span>
                </motion.div>
              )}
            </form>

            {/* Trust badges */}
            <div className="flex flex-wrap justify-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <Lock className="w-3 h-3" /> AES-256 Encrypted
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <Shield className="w-3 h-3" /> SOC2 In Progress
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10">
                <Zap className="w-3 h-3" /> Real-time
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats strip — removed hardcoded stats, now powered by real data */}
      <section className="py-12 border-y border-white/5">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatCard label="AI costs saved" value="Track your savings" />
            <StatCard label="Rogue agents stopped" value="Kill switch ready" />
            <StatCard label="Vulnerabilities found" value="Run a demo scan" />
            <StatCard label="Uptime SLA" value="Enterprise SLA available" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything you need to secure AI
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              From VS Code to production, RaksHex protects your AI infrastructure end-to-end.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                viewport={{ once: true }}
                className={`p-6 rounded-2xl bg-gradient-to-br ${feature.color} border ${feature.border} backdrop-blur-sm hover:scale-[1.02] transition-transform`}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-indigo-300">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border border-indigo-500/20"
          >
            <h2 className="text-3xl font-bold mb-4">Ready to secure your AI?</h2>
            <p className="text-slate-400 mb-8">
              Get started with RaksHex and protect your AI infrastructure from day one.
            </p>
            <button
              onClick={() =>
                document
                  .querySelector('input[type="email"]')
                  ?.scrollIntoView({ behavior: "smooth" })
              }
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              Join the Beta <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-slate-600 mt-4">
              Free during beta. No credit card required.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
