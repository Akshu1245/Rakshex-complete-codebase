import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/app/api/admin/_lib";
import { readAdminEmails } from "@/app/api/admin/_auth";

export const dynamic = "force-dynamic";

/**
 * CEO gate for the whole /admin section. Signed-out visitors go to /login;
 * signed-in non-admins get an honest "not authorized" page instead of the
 * dashboard. The data routes re-check the session server-side anyway.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?callbackUrl=/admin");

  if (!isAdminEmail(session.user.email, await readAdminEmails())) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Not authorized</h1>
          <p className="text-gray-400">
            This area is restricted to RaksHex admins. You are signed in as{" "}
            {session.user.email ?? "an unknown account"}.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
