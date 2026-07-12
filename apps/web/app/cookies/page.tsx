import Link from "next/link";

export const metadata = {
  title: "Cookie Policy | RakshEx",
  description: "How RakshEx uses essential cookies and optional support technologies.",
  alternates: { canonical: "/cookies" },
};

export default function CookiePolicy() {
  return (
    <main className="min-h-screen bg-transparent px-6 pb-20 pt-32 text-slate-300">
      <article className="mx-auto max-w-4xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#14B8A6]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Cookie Policy</h1>
        <p className="mt-3 text-sm text-slate-500">Effective 12 July 2026</p>

        <div className="mt-12 space-y-10 text-sm leading-7">
          <section>
            <h2 className="text-xl font-semibold text-white">Essential technologies</h2>
            <p className="mt-3">
              RakshEx uses first-party session, authentication, CSRF, security, and preference
              technologies needed to operate the website and dashboard. Disabling them can prevent
              sign-in or core functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What is stored</h2>
            <div className="mt-4 overflow-x-auto border border-slate-800">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-slate-950/60 text-white">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Purpose</th>
                    <th className="p-3">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="p-3 font-medium text-white">Essential</td>
                    <td className="p-3">
                      Authentication, session management, CSRF protection, and security
                    </td>
                    <td className="p-3">Session or configured account lifetime</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium text-white">Preference</td>
                    <td className="p-3">
                      Optional-cookie and support-chat consent stored locally in the browser
                    </td>
                    <td className="p-3">Until cleared by the user</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Optional providers</h2>
            <p className="mt-3">
              Payment providers may use their own essential checkout technologies when you choose to
              pay. Optional support chat loads only when configured and after optional consent. We
              do not enable advertising cookies by default.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Your controls</h2>
            <p className="mt-3">
              You can remove site data through your browser settings. Clearing RakshEx site data
              also withdraws optional consent. Questions can be sent to privacy@rakshex.in.
            </p>
          </section>
        </div>

        <p className="mt-12 text-sm text-slate-500">
          Also see the{" "}
          <Link href="/privacy" className="text-[#14B8A6] hover:underline">
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link href="/legal" className="text-[#14B8A6] hover:underline">
            Legal Center
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
