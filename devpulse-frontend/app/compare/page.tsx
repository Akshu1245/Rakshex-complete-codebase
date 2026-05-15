"use client";
import Link from "next/link";
import { useState } from "react";

export default function ComparisonIndex() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">DevPulse vs Competitors</h1>
        <p className="text-gray-400 mb-8">Honest comparison pages. No fluff. Just facts.</p>

        <div className="space-y-4">
          {[
            {
              slug: "helicone",
              name: "Helicone",
              tagline: "AI observability done right, but missing security",
            },
            {
              slug: "portkey",
              name: "Portkey",
              tagline: "Great gateway, but where's the compliance?",
            },
            {
              slug: "lakera",
              name: "Lakera Guard",
              tagline: "Prompt injection specialist, but only one piece of the puzzle",
            },
            {
              slug: "langsmith",
              name: "LangSmith",
              tagline: "LLM tracing champion, not a security platform",
            },
            {
              slug: "datadog",
              name: "Datadog LLM",
              tagline: "Observability giant, but AI governance is an afterthought",
            },
            {
              slug: "snyk",
              name: "Snyk",
              tagline: "Code security leader, blind to API and AI surfaces",
            },
          ].map((comp) => (
            <Link
              key={comp.slug}
              href={`/compare/${comp.slug}`}
              className="block bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors group"
            >
              <h3 className="text-xl font-bold mb-1 group-hover:text-blue-400 transition-colors">
                DevPulse vs {comp.name}
              </h3>
              <p className="text-gray-400 text-sm">{comp.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
