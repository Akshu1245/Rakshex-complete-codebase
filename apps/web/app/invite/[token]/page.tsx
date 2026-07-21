"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/components/AuthProvider";

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";
  const { user, loading: authLoading } = useAuth();

  const inviteQuery = trpc.team.getInvitationByToken.useQuery(
    { token },
    { enabled: Boolean(token) && Boolean(user) },
  );

  const acceptMutation = trpc.team.acceptInvitationByToken.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
  });

  const declineMutation = trpc.team.declineInvitationByToken.useMutation({
    onSuccess: () => {
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
          <h1 className="text-2xl font-bold text-blue-400">Team invitation</h1>
          <p className="text-gray-400">Sign in with the invited email to accept this invite.</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium"
          >
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  if (inviteQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-950">
        <p className="text-gray-400">Loading invitation...</p>
      </div>
    );
  }

  if (inviteQuery.isError || !inviteQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gray-950 p-6">
        <div className="max-w-md w-full space-y-4 text-center">
          <h1 className="text-2xl font-bold text-red-400">Invitation not found</h1>
          <p className="text-gray-400">This invite may have expired or already been used.</p>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const inv = inviteQuery.data;

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-gray-950 p-6">
      <div className="max-w-md w-full bg-black/50 border border-gray-700 rounded-lg p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">Join workspace</h1>
          <p className="text-gray-400 mt-2">
            <strong className="text-white">{inv.inviterName}</strong> invited you to{" "}
            <strong className="text-white">{inv.workspaceName}</strong> as{" "}
            <span className="capitalize text-blue-300">{inv.role}</span>.
          </p>
        </div>

        {(acceptMutation.error || declineMutation.error) && (
          <p className="text-sm text-red-300" role="alert">
            {acceptMutation.error?.message || declineMutation.error?.message}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => acceptMutation.mutate({ token })}
            disabled={acceptMutation.isPending}
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium"
          >
            {acceptMutation.isPending ? "Accepting..." : "Accept invite"}
          </button>
          <button
            onClick={() => declineMutation.mutate({ token })}
            disabled={declineMutation.isPending}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg font-medium"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
