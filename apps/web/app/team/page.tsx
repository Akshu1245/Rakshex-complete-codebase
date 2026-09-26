"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EmptyState } from "@/components/EmptyState";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useApi, useApiMutation } from "@/lib/api";
import { NotConnectedState } from "@/components/NotConnected";

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

interface MemberRow {
  userId: number;
  active: boolean;
  name?: string | null;
  email?: string | null;
  role: string;
}

interface InvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

interface PermissionsShape {
  permissions: {
    members: { write: boolean; delete: boolean };
    billing: { read: boolean };
  };
}

interface SubscriptionShape {
  reservedSeats?: number;
  subscription?: { seatCount?: number; plan?: string };
  availablePlans?: Array<{ plan?: string; includedSeats?: number }>;
}

export default function TeamPage() {
  // Team management has no /v1 equivalent on the Workers deployment —
  // /api/team answers 501 not_connected. Mutations surface an honest
  // error instead of pretending to invite or change roles.
  const { workspaceId, workspace, workspaces, switchWorkspace, isLoading } = useWorkspace();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableRole>("viewer");
  const [message, setMessage] = useState<string | null>(null);
  const [removeUserId, setRemoveUserId] = useState<number | null>(null);

  const members = useApi<MemberRow[]>(
    workspaceId > 0 ? `/api/team?workspaceId=${workspaceId}&kind=members` : null,
  );
  const invitations = useApi<InvitationRow[]>(
    workspaceId > 0 ? `/api/team?workspaceId=${workspaceId}&kind=invitations` : null,
  );
  const permissions = useApi<PermissionsShape>(
    workspaceId > 0 ? `/api/team?workspaceId=${workspaceId}&kind=permissions` : null,
  );
  const subscription = useApi<SubscriptionShape>(
    workspaceId > 0 && Boolean(permissions.data?.permissions.billing.read)
      ? `/api/billing?workspaceId=${workspaceId}&kind=workspace-subscription`
      : null,
  );

  const canWrite = Boolean(permissions.data?.permissions.members.write);
  const canDelete = Boolean(permissions.data?.permissions.members.delete);
  const reservedSeats = subscription.data?.reservedSeats;
  const seatLimit =
    subscription.data?.subscription?.seatCount ??
    subscription.data?.availablePlans?.find(
      (plan) => plan.plan === subscription.data?.subscription?.plan,
    )?.includedSeats;

  const refresh = () => {
    members.refetch();
    invitations.refetch();
    subscription.refetch();
  };

  const invite = useApiMutation<{ workspaceId: number; email: string; role: string }, unknown>(
    "/api/team",
    "POST",
  );
  const updateRole = useApiMutation<{ workspaceId: number; userId: number; role: string }, unknown>(
    "/api/team",
    "PATCH",
  );
  const remove = useApiMutation<{ workspaceId: number; userId: number }, unknown>(
    "/api/team",
    "DELETE",
  );
  const resend = useApiMutation<{ workspaceId: number; invitationId: string }, unknown>(
    "/api/team",
    "POST",
  );
  const cancelInvite = useApiMutation<{ workspaceId: number; invitationId: string }, unknown>(
    "/api/team",
    "DELETE",
  );

  const runInvite = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    invite.mutate(
      { workspaceId, email: email.trim(), role },
      {
        onSuccess: () => {
          setEmail("");
          setMessage("Invitation sent.");
          refresh();
        },
        onError: (error) => setMessage(error.message),
      },
    );
  };

  const runUpdateRole = (userId: number, nextRole: string) => {
    setMessage(null);
    updateRole.mutate(
      { workspaceId, userId, role: nextRole },
      { onSuccess: refresh, onError: (error) => setMessage(error.message) },
    );
  };

  const runRemove = (userId: number) => {
    setMessage(null);
    remove.mutate(
      { workspaceId, userId },
      {
        onSuccess: () => {
          setRemoveUserId(null);
          refresh();
        },
        onError: (error) => setMessage(error.message),
      },
    );
  };

  const runResend = (invitationId: string) => {
    setMessage(null);
    resend.mutate(
      { workspaceId, invitationId },
      {
        onSuccess: () => setMessage("Invitation resent."),
        onError: (error) => setMessage(error.message),
      },
    );
  };

  const runCancelInvite = (invitationId: string) => {
    setMessage(null);
    cancelInvite.mutate(
      { workspaceId, invitationId },
      { onSuccess: refresh, onError: (error) => setMessage(error.message) },
    );
  };

  const activeMembers = useMemo(
    () => (members.data ?? []).filter((member) => member.active),
    [members.data],
  );

  const teamNotConnected = members.notConnected || permissions.notConnected;

  if (isLoading) {
    return <div className="p-8 text-neutral-400">Loading team…</div>;
  }

  if (!workspace) {
    return (
      <div className="p-8 text-white">
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
    <main className="mx-auto max-w-6xl space-y-8 p-8 text-white">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-teal-400">Team</h1>
          <p className="mt-1 text-neutral-400">
            Workspace-scoped access, invitations, roles, and paid seats.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {workspaces.length > 1 && (
            <select
              value={workspaceId}
              onChange={(event) => switchWorkspace(Number(event.target.value))}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
              aria-label="Active workspace"
            >
              {workspaces.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          )}
          <Link href="/workspace" className="text-sm text-teal-400 hover:underline">
            Workspace & billing
          </Link>
        </div>
      </header>

      {reservedSeats !== undefined && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-4 text-sm">
          Seats reserved: <strong>{reservedSeats}</strong>
          {seatLimit ? (
            <>
              {" "}
              of <strong>{seatLimit}</strong>
            </>
          ) : null}
        </div>
      )}

      {canWrite && !teamNotConnected && (
        <section className="rounded-lg border border-neutral-800 p-6">
          <h2 className="text-lg font-medium">Invite member</h2>
          <form className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]" onSubmit={runInvite}>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="colleague@company.com"
              required
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2"
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
              className="rounded-md bg-teal-600 px-4 py-2 disabled:opacity-50"
            >
              {invite.isPending ? "Sending…" : "Send invite"}
            </button>
          </form>
        </section>
      )}

      {message && (
        <p className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-sm">{message}</p>
      )}

      {teamNotConnected && (
        <NotConnectedState
          resource="Team"
          detail="Listing members and invitations needs the team backend, which isn't connected on this deployment yet. Nothing is invited, changed or removed here."
        />
      )}

      {!teamNotConnected && (
        <>
          <section className="rounded-lg border border-neutral-800 p-6">
            <h2 className="text-lg font-medium">Active members</h2>
            <div className="mt-4 divide-y divide-neutral-800">
              {activeMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex flex-wrap items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p>{member.name || member.email || `User #${member.userId}`}</p>
                    {member.name && <p className="text-sm text-neutral-500">{member.email}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={member.role}
                      disabled={!canWrite || member.role === "owner" || updateRole.isPending}
                      onChange={(event) =>
                        runUpdateRole(member.userId, event.target.value as AssignableRole)
                      }
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm disabled:opacity-60"
                    >
                      {member.role === "owner" && <option value="owner">Owner</option>}
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {canDelete && member.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() => setRemoveUserId(member.userId)}
                        className="text-sm text-red-400 hover:underline"
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
            <section className="rounded-lg border border-neutral-800 p-6">
              <h2 className="text-lg font-medium">Pending invitations</h2>
              <div className="mt-4 divide-y divide-neutral-800">
                {invitations.data?.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <div>
                      <p>{invitation.email}</p>
                      <p className="text-sm text-neutral-500">
                        {invitation.role.replaceAll("_", " ")} · expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-3 text-sm">
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => runResend(invitation.id)}
                          className="text-teal-400 hover:underline"
                        >
                          Resend
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => runCancelInvite(invitation.id)}
                          className="text-red-400 hover:underline"
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
              if (removeUserId !== null) runRemove(removeUserId);
            }}
            onCancel={() => setRemoveUserId(null)}
          />
        </>
      )}
    </main>
  );
}
