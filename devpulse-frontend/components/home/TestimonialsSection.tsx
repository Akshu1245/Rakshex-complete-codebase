"use client";

import { useState } from "react";

export function TestimonialsSection() {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    const GOOGLE_SHEET_URL =
      "https://script.google.com/macros/s/AKfycbxmbtnE42vkdidiPstOMiegZeqTMJQNB57ybAQeXgMRPJW6Hz_436b6qzR1ik93mb4/exec";

    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "website" }),
      });
    } catch (err) {
      // no-cors may throw in Brave even though the request succeeds
      console.log("[Waitlist] fetch note:", err);
    }
    setSuccess(true);
    setEmail("");
    setPending(false);
  };

  return (
    <section
      className="relative w-full max-w-[1280px] mx-auto py-20 px-6 xl:px-8 bg-transparent"
      id="waitlist"
    >
      <div className="max-w-2xl mx-auto bg-[#1A1F2E] border border-[#14B8A6]/20 p-8 sm:p-12 rounded-2xl shadow-xl text-center relative overflow-hidden group hover:border-[#14B8A6]/40 transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#14B8A6]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#14B8A6]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center gap-6 relative z-10">
          <span className="text-xs font-bold text-[#14B8A6] uppercase tracking-widest bg-[#14B8A6]/10 px-3 py-1 rounded-full border border-[#14B8A6]/20">
            Social Proof
          </span>

          <h2 className="text-3xl sm:text-[36px] font-extrabold text-white font-sans leading-tight tracking-[-0.02em]">
            Be the first. Join the waitlist.
          </h2>
          <p className="text-[#9CA3AF] text-base sm:text-lg leading-relaxed max-w-[480px] font-sans -mt-2">
            Early access. Free forever for first 100 users.
          </p>

          <div className="w-full mt-4">
            {success ? (
              <div className="p-4 bg-[#14B8A6]/10 border border-[#14B8A6]/30 rounded-[6px] text-[#14B8A6] text-sm font-mono text-center">
                ✓ You're on the list! We'll be in touch.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="w-full space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-4 py-3 bg-[#0F1419] border border-[#14B8A6]/30 hover:border-[#14B8A6] focus:border-[#14B8A6] focus:outline-none text-white placeholder-[#6B7280] rounded-[6px] text-sm font-sans transition-all duration-150"
                    disabled={pending}
                  />
                  <button
                    type="submit"
                    disabled={pending}
                    className="bg-[#14B8A6] hover:bg-[#0D9488] active:bg-[#0A7F6F] text-white hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_4px_12px_rgba(20,184,166,0.2)] font-semibold px-6 py-3 text-sm tracking-wide font-sans rounded-[6px] disabled:opacity-50 transition-all duration-200 shrink-0 transform"
                  >
                    {pending ? "Joining..." : "Join Waitlist"}
                  </button>
                </div>
                {error && <p className="text-red-400 text-xs text-left font-mono mt-1">{error}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
