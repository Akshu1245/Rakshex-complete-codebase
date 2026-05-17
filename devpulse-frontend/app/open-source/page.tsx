import Link from "next/link";

export const metadata = {
  title: "Open Source — DevPulse",
  description:
    "DevPulse is built on open source. View our GitHub repository, contribute to the project, and explore our tech stack.",
  alternates: { canonical: "/open-source" },
};

export default function OpenSourcePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="text-center py-20 px-4 border-b border-gray-800">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Built in the Open</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Transparency is a security feature. View our code, audit our practices, and contribute to
          the future of AI governance.
        </p>
      </div>

      <div className="max-w-4xl mx-auto py-16 px-4 space-y-16">
        {/* GitHub Stats */}
        <div className="grid md:grid-cols-3 gap-6 text-center">
          {[
            { value: "478+", label: "Server Tests" },
            { value: "37", label: "API Routers" },
            { value: "18", label: "DB Migrations" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
              <div className="text-3xl font-bold text-blue-400">{s.value}</div>
              <div className="text-gray-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tech Stack */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Tech Stack</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { layer: "Frontend", tech: "Next.js 14, React 18, TypeScript, Tailwind CSS, tRPC" },
              { layer: "Backend", tech: "Node.js, Express, tRPC, Drizzle ORM, Zod" },
              { layer: "Database", tech: "MySQL 8, Redis 7, BullMQ" },
              { layer: "AI/ML", tech: "TensorFlow.js, ONNX Runtime, Custom classifiers" },
              { layer: "Infrastructure", tech: "Docker, Docker Compose, Kubernetes Helm charts" },
              { layer: "Testing", tech: "Vitest, Playwright, Supertest, MSW" },
            ].map((row) => (
              <div key={row.layer} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <span className="font-bold text-blue-400">{row.layer}:</span>{" "}
                <span className="text-gray-300 text-sm">{row.tech}</span>
              </div>
            ))}
          </div>
        </section>

        {/* License */}
        <section className="bg-gray-800 p-8 rounded-xl border border-gray-700">
          <h2 className="text-xl font-bold mb-4">License</h2>
          <p className="text-gray-300 text-sm leading-relaxed mb-4">
            DevPulse is open source under the <strong>MIT License</strong>. You are free to use,
            modify, and distribute the code. Commercial use is permitted. Attribution is appreciated
            but not required.
          </p>
          <p className="text-gray-400 text-sm">
            Enterprise features (SSO, RBAC, audit logs) are available under a separate commercial
            license. Contact us for enterprise licensing.
          </p>
        </section>

        {/* Contributing */}
        <section>
          <h2 className="text-2xl font-bold mb-6">How to Contribute</h2>
          <div className="space-y-4">
            {[
              "1. Fork the repository on GitHub",
              "2. Create a feature branch: git checkout -b feature/amazing-idea",
              "3. Make your changes with tests",
              "4. Run the test suite: pnpm test",
              "5. Submit a pull request with a clear description",
            ].map((step) => (
              <div
                key={step}
                className="bg-gray-800 p-4 rounded-lg border border-gray-700 text-gray-300 text-sm font-mono"
              >
                {step}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="https://github.com/Akshu1245/devpulse-complete-codebase"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-white text-gray-900 px-8 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            View on GitHub →
          </Link>
        </div>
      </div>
    </div>
  );
}
