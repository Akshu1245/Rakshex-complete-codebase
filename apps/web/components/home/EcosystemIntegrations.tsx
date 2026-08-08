"use client";

import React from "react";
import { Network, Shield } from "lucide-react";

interface IntegrationItem {
  name: string;
  category: string;
  svg: React.ReactNode;
}

const INTEGRATIONS: IntegrationItem[] = [
  {
    name: "OpenAI",
    category: "LLM Provider",
    svg: (
      <svg className="w-6 h-6 fill-current text-white" viewBox="0 0 24 24">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7941.7941 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.535-3.0137l.142.0852 4.783 2.7582a.7941.7941 0 0 0 .7854 0l5.833-3.3692v2.3325a.0805.0805 0 0 1-.0332.0615l-4.8351 2.7914a4.4992 4.4992 0 0 1-6.1401-1.646zm-1.127-10.374a4.4851 4.4851 0 0 1 2.3655-1.973l-.0047.161 0 5.5165a.7893.7893 0 0 0 .3928.6812l5.833 3.3693-2.02 1.1685a.0758.0758 0 0 1-.0711 0l-4.8303-2.7914a4.504 4.504 0 0 1-1.6652-6.1321z" />
      </svg>
    ),
  },

  {
    name: "Azure OpenAI",
    category: "LLM Provider",
    svg: (
      <svg className="w-6 h-6 fill-current text-blue-400" viewBox="0 0 24 24">
        <path d="M13.05 4.24L6.56 19.76H3.4L9.9 4.24h3.15zm7.55 0L14.1 19.76h-3.15L17.44 4.24h3.16z" />
      </svg>
    ),
  },
  {
    name: "AWS Bedrock",
    category: "LLM Provider",
    svg: (
      <svg className="w-6 h-6 fill-current text-amber-500" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zm0 9L2 16l10 5 10-5-10-5z" />
      </svg>
    ),
  },
  {
    name: "Google Vertex / Gemini",
    category: "LLM Provider",
    svg: (
      <svg className="w-6 h-6 fill-current text-sky-400" viewBox="0 0 24 24">
        <path d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12z" />
      </svg>
    ),
  },
  {
    name: "GitHub Copilot",
    category: "Coding Agent",
    svg: (
      <svg className="w-6 h-6 fill-current text-slate-300" viewBox="0 0 24 24">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.7-1.28-1.7-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.43-2.69 5.4-5.25 5.69.41.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.2.67.8.56A10.52 10.52 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5z" />
      </svg>
    ),
  },
  {
    name: "Cursor",
    category: "Coding Agent",
    svg: (
      <svg className="w-6 h-6 fill-current text-purple-400" viewBox="0 0 24 24">
        <path d="M3 2l18 10-8 2-2 8L3 2z" />
      </svg>
    ),
  },
  {
    name: "OpenAI-Compatible",
    category: "Self-Hosted / Custom",
    svg: (
      <svg className="w-6 h-6 fill-current text-teal-400" viewBox="0 0 24 24">
        <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.5h-2v-5h2v5zm0-7h-2v-2h2v2z" />
      </svg>
    ),
  },
];

export function EcosystemIntegrations() {
  return (
    <section className="w-full py-20 px-4 md:px-8 bg-[#070A10] relative overflow-hidden border-t border-slate-800/80">
      <div className="max-w-6xl mx-auto space-y-12 relative z-10">
        {/* Section Header */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14B8A6]/10 border border-[#14B8A6]/30 text-[#14B8A6] text-xs font-semibold uppercase tracking-wider font-mono">
            <Network className="w-3.5 h-3.5" />
            Supported Providers
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white font-sans">
            One Policy Model, <span className="text-[#14B8A6]">Every Provider</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            The same semantic action and delegated-authority model applies regardless of which LLM
            provider or coding agent is making the call.
          </p>
        </div>

        {/* Integration Hub Canvas Diagram */}
        <div className="relative bg-[#0B0F17] border border-slate-800 rounded-3xl p-8 md:p-12 overflow-hidden shadow-2xl">
          {/* Animated Glowing Conduit Lines */}
          <div className="absolute inset-0 pointer-events-none opacity-30">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#14B8A6] to-transparent animate-pulse" />
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-[#14B8A6] to-transparent animate-pulse" />
          </div>

          {/* Central RaksHex Core Node */}
          <div className="flex justify-center mb-10 relative z-20">
            <div className="bg-[#081219] border-2 border-[#14B8A6] rounded-2xl p-6 shadow-[0_0_40px_rgba(20,184,166,0.3)] flex items-center gap-4 hover:scale-105 transition-transform">
              <div className="w-12 h-12 rounded-xl bg-[#14B8A6]/20 border border-[#14B8A6] flex items-center justify-center text-[#14B8A6]">
                <Shield className="w-7 h-7 animate-pulse" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg font-sans">RaksHex Agent Firewall</h3>
                <p className="text-slate-400 text-xs font-mono">
                  Action Authorization &amp; Policy Engine
                </p>
              </div>
            </div>
          </div>

          {/* Integration Grid with Real Brand Logos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
            {INTEGRATIONS.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#0E131E] border border-slate-800 rounded-xl p-4 flex items-center gap-3 hover:border-[#14B8A6]/50 hover:bg-[#111724] transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  {item.svg}
                </div>
                <div>
                  <h4 className="text-white font-semibold text-xs font-sans group-hover:text-[#14B8A6] transition-colors">
                    {item.name}
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    {item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
