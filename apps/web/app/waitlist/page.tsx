"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";

const PROVIDERS = ["OpenAI", "Anthropic", "Gemini", "Azure OpenAI", "AWS Bedrock", "OpenRouter"];
const FRAMEWORKS = ["LangChain", "LangGraph", "MCP", "LlamaIndex", "Vercel AI SDK", "Custom"];

type AgentStage = "exploring" | "internal" | "production";
type PilotIntent = "yes" | "maybe" | "following";

export default function WaitlistPage() {
  const formStartedAt = useRef(Date.now());
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [agentStage, setAgentStage] = useState<AgentStage | "">("");
  const [providers, setProviders] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [monthlySpend, setMonthlySpend] = useState("unknown");
  const [pain, setPain] = useState("");
  const [pilotInterest, setPilotInterest] = useState<PilotIntent | "">("");
  const [designPartner, setDesignPartner] = useState(false);
  const [website, setWebsite] = useState("");
  const [formError, setFormError] = useState("");
  const [tracking, setTracking] = useState({
    source: "waitlist",
    utmSource: "direct",
    utmMedium: "website",
    utmCampaign: "private-beta",
    utmContent: "",
    referredByCode: "",
    referrer: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTracking({
      source: params.get("utm_source") || params.get("source") || "waitlist",
      utmSource: params.get("utm_source") || "direct",
      utmMedium: params.get("utm_medium") || "website",
      utmCampaign: params.get("utm_campaign") || "private-beta",
      utmContent: params.get("utm_content") || "",
      referredByCode: params.get("ref") || "",
      referrer: document.referrer || "",
    });
  }, []);

  const joinWaitlist = trpc.waitlist.join.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  const toggle = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!role || !agentStage || !pain || !pilotInterest) {
      setFormError("Choose your role, agent stage, main problem, and pilot intent so the traction data stays accurate.");
      return;
    }
    setFormError("");
    joinWaitlist.mutate({
      email,
      evaluationType: designPartner ? "Design partner" : "Private beta",
      role,
      company: company || undefined,
      agentStage,
      providers,
      frameworks,
      monthlySpend,
      pain,
      pilotInterest,
      designPartner,
      ...tracking,
      formStartedAt: formStartedAt.current,
      website,
    });
  };

  const incomplete = !email || !role || !agentStage || !pain || !pilotInterest;

  return (
    <main className="min-h-screen bg-transparent px-5 pb-20 pt-[126px] text-white sm:px-6 xl:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <section className="pt-4 lg:sticky lg:top-[126px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/25 bg-[#14B8A6]/[0.07] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-[#8FE3D8]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified private beta
          </div>
          <h1 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.04em] sm:text-5xl">Join the RaksHex agent-governance beta.</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-neutral-400">
            We prioritize people already building or operating AI agents. Any real email is welcome — Gmail, Outlook, Yahoo, Proton, university and work addresses all count after verification.
          </p>
          <div className="mt-8 space-y-3 border-t border-white/[0.08] pt-6 text-sm leading-6 text-neutral-400">
            <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#14B8A6]" /> Email ownership is verified before a signup counts.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#14B8A6]" /> Relevant referrals can improve priority; production fit matters more than raw volume.</p>
            <p className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[#14B8A6]" /> No pricing or checkout is required for this private beta.</p>
          </div>
          <div className="mt-8 flex gap-5 text-xs">
            <Link href="/demo" className="font-semibold text-[#14B8A6] no-underline hover:text-[#5ED8CA]">Public demo →</Link>
            <Link href="/blog" className="font-semibold text-neutral-400 no-underline hover:text-white">Research notes →</Link>
          </div>
        </section>

        {!submitted ? (
          <section className="rounded-2xl border border-white/[0.09] bg-[#090D14]/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-8">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">Qualified beta request</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em]">Tell us enough to route your request correctly.</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Company and spend are optional. Role, stage, problem and pilot intent are explicit so we never inflate traction from preselected answers.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-7">
              <input aria-hidden="true" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="absolute left-[-9999px] h-px w-px opacity-0" name="website" />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-semibold text-neutral-300">
                  Email <span className="text-[#14B8A6]">*</span>
                  <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com or you@company.com" className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-black/25 px-4 text-base text-white placeholder:text-neutral-700 focus:border-[#14B8A6]/60 focus:outline-none" />
                  <span className="mt-1 block text-xs font-normal text-neutral-600">Personal email is completely fine.</span>
                </label>

                <label className="text-sm font-semibold text-neutral-300">
                  Role <span className="text-[#14B8A6]">*</span>
                  <select required value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-[#090D14] px-3 text-sm text-white">
                    <option value="">Select your role</option>
                    <option>AI / LLM engineer</option><option>Founder / CTO</option><option>Platform / infrastructure</option><option>Security / DevSecOps</option><option>SRE / MLOps</option><option>Backend engineer</option><option>Student / researcher</option><option>Other</option>
                  </select>
                </label>

                <label className="text-sm font-semibold text-neutral-300">
                  Company / project <span className="font-normal text-neutral-600">optional</span>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={192} placeholder="Acme AI" className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-black/25 px-4 text-sm text-white placeholder:text-neutral-700" />
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-neutral-300">Where are your agents today? <span className="text-[#14B8A6]">*</span></legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[{ v: "exploring", l: "Exploring" }, { v: "internal", l: "Internal use" }, { v: "production", l: "Production" }].map((item) => (
                    <button key={item.v} type="button" onClick={() => setAgentStage(item.v as AgentStage)} className={`rounded-lg border px-3 py-3 text-sm ${agentStage === item.v ? "border-[#14B8A6]/50 bg-[#14B8A6]/[0.08] text-[#8FE3D8]" : "border-white/10 text-neutral-400"}`}>{item.l}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-neutral-300">AI providers in your stack <span className="font-normal text-neutral-600">optional</span></legend>
                <div className="mt-3 flex flex-wrap gap-2">{PROVIDERS.map((item) => <button key={item} type="button" onClick={() => toggle(item, providers, setProviders)} className={`rounded-full border px-3 py-2 text-xs ${providers.includes(item) ? "border-[#14B8A6]/50 bg-[#14B8A6]/[0.08] text-[#8FE3D8]" : "border-white/10 text-neutral-400"}`}>{item}</button>)}</div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-semibold text-neutral-300">Agent / orchestration stack <span className="font-normal text-neutral-600">optional</span></legend>
                <div className="mt-3 flex flex-wrap gap-2">{FRAMEWORKS.map((item) => <button key={item} type="button" onClick={() => toggle(item, frameworks, setFrameworks)} className={`rounded-full border px-3 py-2 text-xs ${frameworks.includes(item) ? "border-[#14B8A6]/50 bg-[#14B8A6]/[0.08] text-[#8FE3D8]" : "border-white/10 text-neutral-400"}`}>{item}</button>)}</div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-neutral-300">
                  Approx. monthly AI/API spend
                  <select value={monthlySpend} onChange={(e) => setMonthlySpend(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-[#090D14] px-3 text-sm text-white">
                    <option value="unknown">Don't know / prefer not to say</option><option value="under-100">Under $100</option><option value="100-500">$100–$500</option><option value="500-2000">$500–$2K</option><option value="2000-10000">$2K–$10K</option><option value="10000-plus">$10K+</option>
                  </select>
                </label>

                <label className="text-sm font-semibold text-neutral-300">
                  Biggest problem <span className="text-[#14B8A6]">*</span>
                  <select required value={pain} onChange={(e) => setPain(e.target.value)} className="mt-2 min-h-12 w-full rounded-lg border border-white/10 bg-[#090D14] px-3 text-sm text-white">
                    <option value="">Select the main problem</option><option value="agent-permissions">Agent permissions / excessive agency</option><option value="credential-exposure">Credential exposure</option><option value="mcp-governance">MCP / tool governance</option><option value="runaway-cost">Runaway AI/API cost</option><option value="audit-evidence">Audit / compliance evidence</option><option value="shadow-ai">Unknown / shadow AI usage</option><option value="other">Other</option>
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-neutral-300">Would you test RaksHex in the next 30 days? <span className="text-[#14B8A6]">*</span></legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {[{ v: "yes", l: "Yes" }, { v: "maybe", l: "Maybe" }, { v: "following", l: "Just following" }].map((item) => (
                    <button key={item.v} type="button" onClick={() => setPilotInterest(item.v as PilotIntent)} className={`rounded-lg border px-3 py-3 text-sm ${pilotInterest === item.v ? "border-[#14B8A6]/50 bg-[#14B8A6]/[0.08] text-[#8FE3D8]" : "border-white/10 text-neutral-400"}`}>{item.l}</button>
                  ))}
                </div>
              </fieldset>

              <label className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/15 p-4 text-sm text-neutral-300">
                <input type="checkbox" checked={designPartner} onChange={(e) => setDesignPartner(e.target.checked)} className="mt-1 h-4 w-4 accent-[#14B8A6]" />
                <span><strong className="block text-white">I'm open to being a founding design partner.</strong><span className="mt-1 block text-xs leading-5 text-neutral-500">A short founder-led evaluation call and feedback on a real or simulated agent workflow.</span></span>
              </label>

              {formError && <div role="alert" className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">{formError}</div>}
              <button type="submit" disabled={joinWaitlist.isPending || incomplete} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#14B8A6] px-5 text-sm font-semibold text-white hover:bg-[#0D9488] disabled:cursor-not-allowed disabled:opacity-45">
                {joinWaitlist.isPending ? "Submitting…" : <>Join & verify my email <ArrowRight className="h-4 w-4" /></>}
              </button>
              {joinWaitlist.isError && <div role="alert" className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-sm text-red-300">{joinWaitlist.error.message}</div>}
              <p className="text-xs leading-5 text-neutral-600">By joining, you agree that RaksHex may contact you about the private beta. See our <Link href="/privacy" className="text-neutral-400 underline underline-offset-2">Privacy Policy</Link>.</p>
            </form>
          </section>
        ) : (
          <section className="rounded-2xl border border-[#14B8A6]/25 bg-[#0B1414] p-8" aria-live="polite">
            <CheckCircle2 className="h-11 w-11 text-[#14B8A6]" />
            <p className="mt-6 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#14B8A6]">One step left</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em]">Check your inbox and confirm.</h2>
            <p className="mt-4 text-sm leading-6 text-neutral-400">We sent a confirmation link to <strong className="text-white">{email}</strong>. Your request counts as verified only after you press <strong className="text-white">Confirm my spot</strong> on that page.</p>
            <p className="mt-3 text-xs leading-5 text-neutral-600">Already verified emails receive the same privacy-preserving web response, so the form never reveals whether an address was previously registered.</p>
          </section>
        )}
      </div>
    </main>
  );
}
