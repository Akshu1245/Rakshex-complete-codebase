"use client";

import { useState, Suspense, useEffect } from "react";
import Link from "next/link";
import { User, Lock, Bell, ClipboardList, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";

type Tab = "profile" | "security" | "notifications" | "danger" | "audit";

// ============================================================================
// PROFILE TAB
// ============================================================================
function ProfileTab() {
  const { addToast } = useToast();
  const { data: profile, refetch } = trpc.settings.getProfile.useQuery();
  const updateProfile = trpc.settings.updateProfile.useMutation({
    onSuccess: () => {
      refetch();
      setMessage({ type: "success", text: "Profile updated successfully" });
      addToast("success", "Profile updated successfully");
    },
    onError: (err: { message: string }) => {
      setMessage({ type: "error", text: err.message });
    },
  });

  const [name, setName] = useState(profile?.name || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ name, email });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Profile Information</h3>
        <p className="text-sm text-gray-400 mt-1">Update your display name and email address</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${message.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="your@email.com"
          />
          <p className="text-xs text-gray-500 mt-1">Changing email will require verification</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Plan</label>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-blue-900/30 text-blue-400 rounded-full text-sm font-medium capitalize">
              {profile?.plan}
            </span>
            <Link
              href="/pricing"
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
            >
              Upgrade →
            </Link>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
          <span className="px-2 py-1 bg-gray-700 text-gray-300 rounded-full text-sm font-medium capitalize">
            {profile?.role}
          </span>
        </div>

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {updateProfile.isPending ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}

// ============================================================================
// SECURITY TAB
// ============================================================================
function SecurityTab() {
  const { data: sessions, refetch: refetchSessions } = trpc.settings.getSessions.useQuery();
  const revokeSession = trpc.settings.revokeSession.useMutation({
    onSuccess: () => refetchSessions(),
  });
  const revokeAllSessions = trpc.settings.revokeAllSessions.useMutation({
    onSuccess: () => refetchSessions(),
  });
  const { addToast } = useToast();
  const changePassword = trpc.settings.changePassword.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Password changed successfully" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      addToast("success", "Password changed successfully");
    },
    onError: (err: { message: string }) => {
      setMessage({ type: "error", text: err.message });
    },
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [twoFASecret, setTwoFASecret] = useState("");
  const [twoFAOtpauthUri, setTwoFAOtpauthUri] = useState("");
  const [twoFAVerifyCode, setTwoFAVerifyCode] = useState("");
  const [twoFAMessage, setTwoFAMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disable2FAPassword, setDisable2FAPassword] = useState("");

  // Load 2FA status from backend — use useEffect to avoid calling setState during render
  const { data: twoFAStatus } = trpc.settings.get2FAStatus.useQuery();
  useEffect(() => {
    if (twoFAStatus !== undefined) {
      setTwoFAEnabled(twoFAStatus.enabled);
    }
  }, [twoFAStatus]);

  const setup2FAMutation = trpc.settings.setup2FA.useMutation({
    onSuccess: (data) => {
      setTwoFASecret(data.secret);
      setTwoFAOtpauthUri(data.otpauthUri);
      setShow2FASetup(true);
      setTwoFAMessage(null);
    },
    onError: (err: { message: string }) => {
      setTwoFAMessage({ type: "error", text: err.message });
    },
  });

  const enable2FAMutation = trpc.settings.enable2FA.useMutation({
    onSuccess: () => {
      setTwoFAEnabled(true);
      setShow2FASetup(false);
      setTwoFAVerifyCode("");
      setTwoFAMessage({ type: "success", text: "2FA has been enabled successfully!" });
    },
    onError: (err: { message: string }) => {
      setTwoFAMessage({ type: "error", text: err.message });
    },
  });

  const disable2FAMutation = trpc.settings.disable2FA.useMutation({
    onSuccess: () => {
      setTwoFAEnabled(false);
      setShowDisable2FA(false);
      setDisable2FAPassword("");
      setTwoFASecret("");
      setTwoFAOtpauthUri("");
      setTwoFAMessage({ type: "success", text: "2FA has been disabled" });
    },
    onError: (err: { message: string }) => {
      setTwoFAMessage({ type: "error", text: err.message });
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setMessage({
        type: "error",
        text: "Password must be at least 8 characters",
      });
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const handleEnable2FA = () => {
    setup2FAMutation.mutate();
  };

  const handleVerify2FA = () => {
    if (twoFAVerifyCode.length === 6 && /^\d{6}$/.test(twoFAVerifyCode)) {
      enable2FAMutation.mutate({ code: twoFAVerifyCode });
    } else {
      setTwoFAMessage({ type: "error", text: "Please enter a valid 6-digit verification code" });
    }
  };

  const handleDisable2FA = () => {
    if (disable2FAPassword.length > 0) {
      disable2FAMutation.mutate({ password: disable2FAPassword });
    }
  };

  return (
    <div className="space-y-8">
      {/* Change Password */}
      <div>
        <h3 className="text-lg font-medium text-white">Change Password</h3>
        <p className="text-sm text-gray-400 mt-1">Update your password</p>

        {message && (
          <div
            className={`mt-4 p-4 rounded-md ${message.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={changePassword.isPending}
            className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {changePassword.isPending ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* 2FA Section */}
      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-white">Two-Factor Authentication</h3>
        <p className="text-sm text-gray-400 mt-1">Add an extra layer of security to your account</p>

        {twoFAMessage && (
          <div
            className={`mt-4 p-4 rounded-md ${twoFAMessage.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
          >
            {twoFAMessage.text}
          </div>
        )}

        {!twoFAEnabled && !show2FASetup && (
          <div className="mt-4 p-4 bg-gray-700/50 rounded-md border border-gray-600">
            <p className="text-sm text-gray-300 mb-3">
              Two-factor authentication is currently{" "}
              <span className="text-red-400 font-medium">disabled</span>. Enable it to require a
              verification code when signing in.
            </p>
            <button
              onClick={handleEnable2FA}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
            >
              Enable 2FA
            </button>
          </div>
        )}

        {show2FASetup && (
          <div className="mt-4 space-y-4">
            <div className="p-4 bg-gray-700/50 rounded-md border border-gray-600">
              <h4 className="text-sm font-medium text-white mb-3">
                Step 1: Scan QR code or enter secret key
              </h4>
              {/* QR Code - Generated via otpauth URI */}
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=192x192&data=${encodeURIComponent(twoFAOtpauthUri)}`}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<div class="text-center p-4"><svg class="w-12 h-12 text-gray-800 mx-auto" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v3h-3v-3zm0 5h3v3h-3v-3zm-3-5h2v2h-2v-2zm0 3h2v2h-2v-2zm3 0h3v5h-3v-5zm-3 2h2v3h-2v-3z"/></svg><p class="text-xs text-gray-500 mt-1">Scan with authenticator app</p></div>';
                    }
                  }}
                />
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Or manually enter this secret key in your authenticator app:
              </p>
              <div className="bg-transparent p-3 rounded-md border border-gray-600">
                <code className="text-blue-400 text-sm font-mono break-all select-all">
                  {twoFASecret}
                </code>
              </div>
            </div>

            <div className="p-4 bg-gray-700/50 rounded-md border border-gray-600">
              <h4 className="text-sm font-medium text-white mb-3">
                Step 2: Enter verification code
              </h4>
              <p className="text-sm text-gray-400 mb-3">
                Enter the 6-digit code from your authenticator app to verify setup.
              </p>
              <div className="flex gap-3 items-start">
                <input
                  type="text"
                  value={twoFAVerifyCode}
                  onChange={(e) =>
                    setTwoFAVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-40 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                <button
                  onClick={handleVerify2FA}
                  disabled={twoFAVerifyCode.length !== 6}
                  className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Verify & Enable
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShow2FASetup(false);
                setTwoFASecret("");
                setTwoFAVerifyCode("");
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel setup
            </button>
          </div>
        )}

        {twoFAEnabled && !show2FASetup && (
          <div className="mt-4 p-4 bg-green-900/20 rounded-md border border-green-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span className="text-green-400 font-medium">2FA is enabled</span>
              </div>
              <button
                onClick={() => setShowDisable2FA(true)}
                className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
              >
                Disable
              </button>
            </div>
          </div>
        )}

        {/* Disable 2FA Modal */}
        {showDisable2FA && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-black/50 rounded-lg max-w-md w-full p-6 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">
                Disable Two-Factor Authentication
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                This will reduce the security of your account. Please enter your password to
                confirm.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={disable2FAPassword}
                  onChange={(e) => setDisable2FAPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Enter your password"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowDisable2FA(false);
                    setDisable2FAPassword("");
                  }}
                  className="flex-1 bg-gray-700 text-gray-300 py-2 px-4 rounded-md hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable2FA}
                  disabled={!disable2FAPassword}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Disable 2FA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Sessions */}
      <div className="border-t border-gray-700 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-white">Active Sessions</h3>
            <p className="text-sm text-gray-400 mt-1">Manage your active sessions across devices</p>
          </div>
          <button
            onClick={() => revokeAllSessions.mutate()}
            disabled={revokeAllSessions.isPending}
            className="text-red-400 hover:text-red-300 text-sm font-medium"
          >
            {revokeAllSessions.isPending ? "Revoking..." : "Revoke All"}
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {sessions?.sessions.length === 0 ? (
            <p className="text-sm text-gray-400">No active sessions</p>
          ) : (
            sessions?.sessions.map(
              (session: {
                id: string;
                userAgent?: string | null;
                ipAddress?: string | null;
                lastActiveAt: string | Date;
              }) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md border border-gray-600"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {session.userAgent?.includes("Mobile") ? "Mobile Device" : "Desktop"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {session.ipAddress || "Unknown IP"} • Last active{" "}
                      {new Date(session.lastActiveAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => revokeSession.mutate({ sessionId: session.id })}
                    disabled={revokeSession.isPending}
                    className="text-red-400 hover:text-red-300 text-sm font-medium"
                  >
                    Revoke
                  </button>
                </div>
              ),
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// NOTIFICATIONS TAB
// ============================================================================
function NotificationsTab() {
  const utils = trpc.useUtils();
  const { data: prefs, isLoading } = trpc.settings.getEmailPreferences.useQuery();
  const updatePrefs = trpc.settings.updateEmailPreferences.useMutation({
    onSuccess: () => {
      utils.settings.getEmailPreferences.invalidate();
      setMessage({ type: "success", text: "Preferences saved" });
    },
    onError: (err: { message: string }) => {
      setMessage({ type: "error", text: err.message });
    },
  });
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const toggle = (
    key: "scanComplete" | "budgetAlerts" | "weeklyDigest" | "teamActivity" | "promotionalEmails",
    value: boolean,
  ) => {
    updatePrefs.mutate({ [key]: value });
  };

  const rows: {
    key: "scanComplete" | "budgetAlerts" | "weeklyDigest" | "teamActivity" | "promotionalEmails";
    label: string;
    description: string;
  }[] = [
    {
      key: "scanComplete",
      label: "Scan completion",
      description: "Get notified when a scan finishes.",
    },
    {
      key: "budgetAlerts",
      label: "Budget alerts",
      description: "Warn me when token spend approaches my limit.",
    },
    {
      key: "weeklyDigest",
      label: "Weekly digest",
      description: "Send me a weekly summary of risk + cost trends.",
    },
    {
      key: "teamActivity",
      label: "Team activity",
      description: "Notify me when teammates run scans or trigger alerts.",
    },
    {
      key: "promotionalEmails",
      label: "Product updates",
      description: "Occasional emails about new RaksHex features.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Email Notifications</h3>
        <p className="text-sm text-gray-400 mt-1">
          Choose which emails you want to receive from RaksHex.
        </p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md ${message.type === "success" ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}
        >
          {message.text}
        </div>
      )}

      {isLoading || !prefs ? (
        <p className="text-sm text-gray-400">Loading preferences…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const checked = Boolean(prefs[row.key as keyof typeof prefs] as unknown as boolean);
            return (
              <label
                key={row.key}
                className="flex items-start justify-between p-3 rounded-md border border-gray-600 hover:bg-gray-700/50"
              >
                <span>
                  <span className="block text-sm font-medium text-white">{row.label}</span>
                  <span className="block text-xs text-gray-400">{row.description}</span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded text-blue-600"
                  checked={checked}
                  disabled={updatePrefs.isPending}
                  onChange={(e) => toggle(row.key, e.target.checked)}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUDIT LOG TAB
// ============================================================================
function AuditTab() {
  const { data: auditLog } = trpc.settings.getAuditLog.useQuery({ limit: 50 });

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-white">Activity</h3>
      <p className="text-sm text-gray-400">Recent security-related events on your account.</p>
      <div className="mt-4 space-y-2">
        {!auditLog?.logs || auditLog.logs.length === 0 ? (
          <p className="text-sm text-gray-400">No recent activity</p>
        ) : (
          auditLog.logs.map(
            (log: {
              id: string;
              action: string;
              ipAddress?: string | null;
              createdAt: string | Date;
            }) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md border border-gray-600 text-sm"
              >
                <div>
                  <span className="font-medium text-white">
                    {log.action.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </span>
                  {log.ipAddress && (
                    <span className="text-gray-400 ml-2">from {log.ipAddress}</span>
                  )}
                </div>
                <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DANGER ZONE TAB
// ============================================================================
function DangerZoneTab() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const router = useRouter();
  const { logout } = useAuth();

  const deleteAccount = trpc.settings.deleteAccount.useMutation({
    onSuccess: () => {
      logout();
      router.push("/");
    },
  });

  const { data: auditLog } = trpc.settings.getAuditLog.useQuery({ limit: 20 });

  return (
    <div className="space-y-8">
      {/* Security Audit Log */}
      <div>
        <h3 className="text-lg font-medium text-white">Security Audit Log</h3>
        <p className="text-sm text-gray-400 mt-1">
          Recent security-related actions on your account
        </p>

        <div className="mt-4 space-y-2">
          {auditLog?.logs.length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            auditLog?.logs.map(
              (log: {
                id: string;
                action: string;
                ipAddress?: string | null;
                createdAt: string | Date;
              }) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-gray-700/50 rounded-md border border-gray-600 text-sm"
                >
                  <div>
                    <span className="font-medium text-white">
                      {log.action
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                    {log.ipAddress && (
                      <span className="text-gray-400 ml-2">from {log.ipAddress}</span>
                    )}
                  </div>
                  <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ),
            )
          )}
        </div>
      </div>

      {/* Delete Account */}
      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-red-400">Delete Account</h3>
        <p className="text-sm text-gray-400 mt-1">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        <div className="mt-4 p-4 bg-red-900/30 border border-red-500/50 rounded-md">
          <p className="text-sm text-red-400">This will delete:</p>
          <ul className="text-sm text-red-400 mt-2 ml-4 list-disc">
            <li>Your profile and authentication data</li>
            <li>All collections and imported APIs</li>
            <li>All scan history and findings</li>
            <li>Team memberships and invitations</li>
            <li>Token usage history and billing records</li>
            <li>Kill switch settings and events</li>
          </ul>
        </div>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="mt-4 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-black/50 rounded-lg max-w-md w-full p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Delete Your Account?</h3>
            <p className="text-sm text-gray-300 mb-4">
              This action cannot be undone. All your data will be permanently removed.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Reason for leaving (optional)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Help us improve..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Type &quot;DELETE MY ACCOUNT&quot; to confirm
              </label>
              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="DELETE MY ACCOUNT"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 bg-gray-700 text-gray-300 py-2 px-4 rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  deleteAccount.mutate({
                    confirmation: confirmation as "DELETE MY ACCOUNT",
                    reason,
                  })
                }
                disabled={confirmation !== "DELETE MY ACCOUNT" || deleteAccount.isPending}
                className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleteAccount.isPending ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN SETTINGS PAGE
// ============================================================================
function SettingsContent() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const { user } = useAuth();

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "audit", label: "Audit Log", icon: ClipboardList },
    { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  ];

  return (
    <div className="">
      {/* Header */}
      <div className="bg-black/50 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Settings</h1>
              <p className="text-sm text-gray-400">Manage your account preferences and security</p>
            </div>
            <Link href="/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md text-left transition-colors ${
                    activeTab === tab.id
                      ? "bg-blue-900/30 text-blue-400 font-medium"
                      : tab.id === "danger"
                        ? "text-red-400 hover:bg-gray-700"
                        : "text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-black/50 rounded-lg border border-gray-700 p-6">
              {activeTab === "profile" && <ProfileTab />}
              {activeTab === "security" && <SecurityTab />}
              {activeTab === "notifications" && <NotificationsTab />}
              {activeTab === "danger" && <DangerZoneTab />}
              {activeTab === "audit" && <AuditTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-transparent">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
