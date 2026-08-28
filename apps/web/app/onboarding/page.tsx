"use client";

const snippet = `import OpenAI from "openai";
import { createRakshexOpenAI } from "@rakshex/sdk";

const openai = createRakshexOpenAI(OpenAI);`;

const env = `RAKSHEX_API_KEY=rk_live_…
RAKSHEX_GATEWAY_URL=https://api.rakshex.in`;

export default function OnboardingPage() {
  return (
    <div className="text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">one import, done.</h1>

        <pre className="mt-8 overflow-x-auto rounded-lg border border-gray-800 bg-black/60 p-5 font-mono text-sm text-gray-200">
          {snippet}
        </pre>

        <pre className="mt-4 overflow-x-auto rounded-lg border border-gray-800 bg-black/60 p-5 font-mono text-sm text-gray-200">
          {env}
        </pre>
      </div>
    </div>
  );
}
