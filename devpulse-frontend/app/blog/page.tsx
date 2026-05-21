import Link from "next/link";

export const metadata = {
  title: "Rakshex Blog — AI Security, Cost Governance, and Compliance",
  description:
    "Articles on securing production AI agents, LLM cost optimization, compliance automation, and AI governance best practices.",
};

const posts = [
  {
    slug: "helicone-alternative",
    title: "Best Helicone Alternative for AI Security (2026)",
    excerpt:
      "Helicone is great for observability but lacks security. Rakshex adds prompt injection detection, API scanning, compliance, and cost governance.",
    date: "May 2026",
    readTime: "6 min",
  },
  {
    slug: "portkey-alternative",
    title: "Best Portkey Alternative for AI Governance (2026)",
    excerpt:
      "Portkey is the best LLM gateway. Rakshex adds security scanning, compliance reporting, and a real kill switch. Honest comparison.",
    date: "May 2026",
    readTime: "6 min",
  },
  {
    slug: "lakera-alternative",
    title: "Best Lakera Alternative for Complete AI Security (2026)",
    excerpt:
      "Lakera Guard is the leader in prompt injection defense. Rakshex covers prompt injection plus API security, compliance, and cost governance.",
    date: "May 2026",
    readTime: "5 min",
  },
];

export default function BlogIndex() {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Rakshex Blog</h1>
        <p className="text-gray-400 mb-8">
          Articles on securing production AI agents, LLM cost optimization, and compliance
          automation.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-colors group"
            >
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime} read</span>
              </div>
              <h2 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">
                {post.title}
              </h2>
              <p className="text-gray-400">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
