import Link from "next/link";

export const metadata = {
  title: "RaksHex Blog — AI Security, Cost Governance, and Compliance",
  description:
    "Articles on securing production AI agents, LLM cost optimization, compliance automation, and AI governance best practices.",
  alternates: {
    canonical: "https://rakshex.in/blog",
  },
};

const posts = [
  {
    slug: "owasp-ai-top-10-2025",
    title: "OWASP AI Top 10 2025: What Every API Developer Needs to Know",
    excerpt:
      "LLM01–LLM10 explained, how each maps to real API vulnerabilities, and how RaksHex detects each one.",
    date: "May 2026",
    readTime: "8 min",
  },
  {
    slug: "prompt-injection-production-attack-patterns",
    title: "Prompt Injection in Production: 5 Real Attack Patterns and How to Stop Them",
    excerpt:
      "Direct/indirect injection, tool call poisoning, jailbreaks, and context window overflows with API-level defenses.",
    date: "May 2026",
    readTime: "7 min",
  },
  {
    slug: "reduce-llm-api-costs-60-percent",
    title: "How to Reduce LLM API Costs by 60% Without Changing Your Model",
    excerpt:
      "Learn how token waste, thinking token attribution, prompt caching, and routing save your cloud bill.",
    date: "May 2026",
    readTime: "6 min",
  },
  {
    slug: "ai-agent-api-security-blind-spot",
    title: "Why Your AI Agent's API is Your Biggest Security Blind Spot",
    excerpt:
      "Why traditional SAST/DAST fail to secure agentic tool execution, and how runtime validation bridges the gap.",
    date: "May 2026",
    readTime: "7 min",
  },
  {
    slug: "helicone-alternative",
    title: "Best Helicone Alternative for AI Security (2026)",
    excerpt:
      "Helicone is great for observability but lacks security. RaksHex adds prompt injection detection, API scanning, compliance, and cost governance.",
    date: "May 2026",
    readTime: "6 min",
  },
  {
    slug: "portkey-alternative",
    title: "Best Portkey Alternative for AI Governance (2026)",
    excerpt:
      "Portkey is the best LLM gateway. RaksHex adds security scanning, compliance reporting, and a real kill switch. Honest comparison.",
    date: "May 2026",
    readTime: "6 min",
  },
  {
    slug: "lakera-alternative",
    title: "Best Lakera Alternative for Complete AI Security (2026)",
    excerpt:
      "Lakera Guard is the leader in prompt injection defense. RaksHex covers prompt injection plus API security, compliance, and cost governance.",
    date: "May 2026",
    readTime: "5 min",
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-transparent text-white pt-28 pb-16 px-6 xl:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold mb-3 text-white">RaksHex Blog</h1>
          <p className="text-[#9CA3AF] text-lg">
            Articles on securing production AI agents, LLM cost optimization, and compliance
            automation.
          </p>
        </div>

        <div className="space-y-4">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block bg-black/40 rounded-xl p-6 border border-[#1A1F2E] hover:border-[#14B8A6]/40 hover:bg-black/60 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 text-sm text-[#6B7280] mb-2">
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime} read</span>
              </div>
              <h2 className="text-lg font-semibold mb-2 text-white group-hover:text-[#14B8A6] transition-colors">
                {post.title}
              </h2>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
