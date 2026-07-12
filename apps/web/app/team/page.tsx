"use client";
import { useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmModal } from "@/components/ConfirmModal";
import { trpc } from "@/lib/trpc";

type Role = "admin" | "editor" | "viewer";

interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: string;
  name?: string;
}

export default function TeamPage() {
  const utils = trpc.useUtils();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);

  const teamQuery = trpc.team.list.useQuery();
  const members: TeamMember[] = (teamQuery.data?.members ?? []) as TeamMember[];
  const loading = teamQuery.isLoading;

  const inviteMutation = trpc.team.invite.useMutation({
    onSuccess: () => {
      setInviteEmail("");
      utils.team.list.invalidate();
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const removeMutation = trpc.team.remove.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      setRemoveConfirm(null);
    },
    onError: (err: { message: string }) => setError(err.message),
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    setError(null);
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleRemoveConfirm = () => {
    if (!removeConfirm) return;
    setError(null);
    removeMutation.mutate({ memberId: removeConfirm });
  };

  return (
    <div className="text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-400">Team</h1>
            <p className="text-gray-400 mt-1">Manage team members and roles</p>
          </div>
          <Link href="/dashboard" className="text-blue-400 hover:text-blue-300">
            ← Dashboard
          </Link>
        </div>

        <div className="mb-8 bg-black/50 p-6 rounded-lg border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Invite Team Member</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="invite-email" className="block text-sm text-gray-400 mb-1">
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                className="w-full px-4 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviteMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-900/40 border border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-4">Team Members</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              compact
              icon={<span>👥</span>}
              title="No team members yet"
              description="Invite a teammate above to share collections, reports, and on-call alerts."
            />
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="bg-black/50 p-4 rounded-lg border border-gray-700 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{member.email}</p>
                    {member.name && <p className="text-sm text-gray-400">{member.name}</p>}
                    <div className="flex gap-4 mt-1 text-sm">
                      <span
                        className={`px-2 py-1 rounded ${
                          member.role === "admin"
                            ? "bg-purple-900/30 text-purple-400"
                            : member.role === "editor"
                              ? "bg-blue-900/30 text-blue-400"
                              : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {member.role.toUpperCase()}
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          member.status === "active"
                            ? "bg-green-900/30 text-green-400"
                            : member.status === "pending"
                              ? "bg-yellow-900/30 text-yellow-400"
                              : "bg-gray-700 text-gray-400"
                        }`}
                      >
                        {member.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setRemoveConfirm(member.id)}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/50 rounded-lg font-medium transition-colors text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remove Team Member Confirmation Modal */}
      <ConfirmModal
        open={!!removeConfirm}
        title="Remove Team Member?"
        message="This will revoke their access to all shared collections, reports, and team features. They will need to be re-invited to regain access."
        confirmLabel="Remove Member"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleRemoveConfirm}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  );
}
