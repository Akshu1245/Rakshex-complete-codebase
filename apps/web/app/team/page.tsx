"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { trpc } from "@/lib/trpc";

type AssignableRole =
  "admin" | "security_lead" | "developer" | "analyst" | "viewer" | "billing_admin";

const ROLE_OPTIONS: Array<{ value: AssignableRole; label: string }> = [
  { value: "viewer", label: "Viewer" },
  { value: "analyst", label: "Analyst" },
  { value: "developer", label: "Developer" },
  { value: "security_lead", label: "Security lead" },
  { value: "billing_admin", label: "Billing admin" },
  { value: "admin", label: "Admin" },
];

export default function TeamPage() {
  const utils = trpc.useUtils();
  const { workspaceId, workspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("viewer");
  const [message, setMessage] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<number | null>(null);

  const members = trpc.workspaces.listMembers.useQuery({ workspaceId }, { enabled: workspaceId > 0 });
  const invitations = trpc.workspaces.listInvitations.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const permissions = trpc.workspaces.myPermissions.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 },
  );
  const subscription = trpc.payment.getWorkspaceSubscription.useQuery(
    { workspaceId },
    { enabled: workspaceId > 0 && Boolean(permissions.data?.permissions.billing.read) },
  );

  const canWrite = Boolean(permissions.data?.permissions.members.write);
  const canDelete = Boolean(permissions.data?.permissions.members.delete);
  const reservedSeats = subscription.data?.reservedSeats;
  const seatLimit =
    subscription.data?.subscription?.seatCount ??
    subscription.data?.availablePlans.find(
      (plan) => plan.plan === subscription.data?.subscription?.plan,
    )?.includedSeats;

  const refresh = async () => {
    await Promise.all([
      utils.workspaces.listMembers.invalidate({ workspaceId }),
      utils.workspaces.listInvitations.invalidate({ workspaceId }),
      utils.payment.getWorkspaceSubscription.invalidate({ workspaceId }),
    ]);
  };

  const invite = trpc.workspaces.inviteMember.useMutation({
    onSuccess: async () => {
      setEmail("");
      setMessage("Invitation sent.");
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });
  const updateRole = trpc.workspaces.updateMemberRole.useMutation({
    onSuccess: refresh,
    onError: (error) => setMessage(error.message),
  });
  const remove = trpc.workspaces.removeMember.useMutation({
    onSuccess: async () => {
      setRemoveUserId(null);
      await refresh();
    },
    onError: (error) => setMessage(error.message),
  });
  const resend = trpc.workspaces.resendInvitation.useMutation({
    onSuccess: () => setMessage("Invitation resent."),
    onError: (error) => setMessage(error.message),
  });
  const cancelInvite = trpc.workspaces.cancelInvitation.useMutation({
    onSuccess: refresh,
    onError: (error) => setMessage(error.message),
  });

  const activeMembers = useMemo(
    () => (members.data ?? []).filter((member) => member.active),
    [members.data],
  );

  if (isLoading) return <div className="p-4 sm:p-8 text-neutral-400">Loading team…</div>;

  if (!workspace) {
    return (
      <div className="p-4 sm:p-8 text-white">
        <EmptyState
          icon={<span>👥</span>}
          title="Create a workspace first"
          description="Workspace membership, roles, invitations, and subscriptions are managed together."
          actions={[{ label: "Open workspace settings", href: "/workspace" }]}
        />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 text-white overflow-x-hidden">
      <header className="flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold text-teal-400">Team</h1>
          <p className="mt-1 text-neutral-400 break-words">
            Workspace-scoped access, invitations, roles, and paid seats.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
          {workspaces.length > 1 && (
            <select
              value={workspaceId}
              onChange={(event) => switchWorkspace(Number(event.target.value))}
              className="w-full sm:w-auto rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              aria-label="Active workspace"
            >
              {workspaces.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          <Link href="/workspace" className="inline-flex min-h-11 items-center text-sm text-teal-400 hover:underline">
            Workspace & billing
          </Link>
        </div>
      </header>

      {reservedSeats !== undefined && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm break-words">
          Seats reserved: <strong>{reservedSeats}</strong>
          {seatLimit ? (
            <>
              {" "}of <strong>{seatLimit}</strong>
            </>
          ) : null}
        </div>
      )}

      {canWrite && (
        <section className="rounded-lg border border-neutral-800 p-4 sm:p-6 min-w-0">
          <h2 className="text-lg font-medium">Invite member</h2>
          <form
            className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              setMessage(null);
              invite.mutate({ workspaceId, email: email.trim(), role });
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@company.com"
              required
              className="min-w-0 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={invite.isPending}
              className="w-full md:w-auto rounded-md bg-teal-600 px-4 py-2 disabled:opacity-50"
            >
              {invite.isPending ? "Sending…" : "Send invite"}
            </button>
          </form>
        </section>
      )}

      {message && (
        <p className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-sm break-words">{message}</p>
      )}

      <section className="rounded-lg border border-neutral-800 p-4 sm:p-6 min-w-0">
        <h2 className="text-lg font-medium">Active members</h2>
        <div className="mt-4 divide-y divide-neutral-800">
          {activeMembers.map((member) => (
            <div key={member.userId} className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words">{member.name || member.email || `User #${member.userId}`}</p>
                {member.name && <p className="text-sm text-neutral-500 break-all">{member.email}</p>}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <select
                  value={member.role}
                  disabled={!canWrite || member.role === "owner" || updateRole.isPending}
                  onChange={(event) =>
                    updateRole.mutate({ workspaceId, userId: member.userId, role: event.target.value as AssignableRole })
                  }
                  className="w-full sm:w-auto rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-60"
                >
                  {member.role === "owner" && <option value="owner">Owner</option>}
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {canDelete && member.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => setRemoveUserId(member.userId)}
                    className="w-full sm:w-auto rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 sm:border-0 sm:px-0 sm:hover:bg-transparent sm:hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {(invitations.data?.length ?? 0) > 0 && (
        <section className="rounded-lg border border-neutral-800 p-4 sm:p-6 min-w-0">
          <h2 className="text-lg font-medium">Pending invitations</h2>
          <div className="mt-4 divide-y divide-neutral-800">
            {invitations.data?.map((invitation) => (
              <div key={invitation.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-all">{invitation.email}</p>
                  <p className="text-sm text-neutral-500 break-words">
                    {invitation.role.replaceAll("_", " ")} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => resend.mutate({ workspaceId, invitationId: invitation.id })}
                      className="rounded-md border border-teal-500/30 px-3 py-2 text-teal-400 hover:bg-teal-500/10"
                    >
                      Resend
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => cancelInvite.mutate({ workspaceId, invitationId: invitation.id })}
                      className="rounded-md border border-red-500/30 px-3 py-2 text-red-400 hover:bg-red-500/10"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmModal
        open={removeUserId !== null}
        title="Remove workspace member?"
        message="Their workspace access will be revoked immediately. Audit history is retained."
        confirmLabel="Remove member"
        cancelLabel="Keep member"
        variant="danger"
        onConfirm={() => {
          if (removeUserId !== null) remove.mutate({ workspaceId, userId: removeUserId });
        }}
        onCancel={() => setRemoveUserId(null)}
      />
    </main>
  );
}