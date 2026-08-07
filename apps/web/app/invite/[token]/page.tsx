"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/components/AuthProvider";

/**
 * Workspace invite accept page.
 * Soft-deprecates team.getInvitationByToken / team.acceptInvitationByToken —
 * workspace invites use workspaces.acceptInvitation with the token from the email link.
 */
export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";
  const { user, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const acceptMutation = trpc.workspaces.acceptInvitation.useMutation({
    onSuccess: () => {
      setAccepted(true);
      router.push("/dashboard");
    },
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-950">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-950 p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold text-blue-400">Workspace invitation</h1>
          <p className="text-gray-400">Sign in with the invited email to accept this invite.</p>
          <Link
            href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-gray-950 p-6">
      <div className="max-w-md w-full bg-black/50 border border-gray-700 rounded-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Join workspace</h1>
          <p className="text-gray-400 mt-2">
            You&apos;ve been invited to a RaksHex workspace. Accept to join with the email on your
            account.
          </p>
        </div>

        {acceptMutation.error && (
          <p className="text-sm text-red-300" role="alert">
            {acceptMutation.error.message}
          </p>
        )}

        {accepted ? (
          <p className="text-sm text-green-400">Invite accepted — redirecting…</p>
        ) : (
          <button
            onClick={() => acceptMutation.mutate({ token })}
            disabled={!token || acceptMutation.isPending}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium"
          >
            {acceptMutation.isPending ? "Accepting..." : "Accept invite"}
          </button>
        )}
      </div>
    </div>
  );
}
