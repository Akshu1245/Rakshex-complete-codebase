"use client";

interface StatusBadgeProps {
  status: string;
  pulse?: boolean;
}

const badgeMap: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Active",
  },
  completed: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Completed",
  },
  running: { bg: "bg-blue-500/15", text: "text-blue-300", dot: "bg-blue-400", label: "Running" },
  pending: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
    label: "Pending",
  },
  failed: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400", label: "Failed" },
  expired: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400", label: "Expired" },
  revoked: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400", label: "Revoked" },
  disabled: { bg: "bg-gray-500/15", text: "text-gray-300", dot: "bg-gray-400", label: "Disabled" },
  critical: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400", label: "Critical" },
  high: { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400", label: "High" },
  medium: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
    label: "Medium",
  },
  low: { bg: "bg-blue-500/15", text: "text-blue-300", dot: "bg-blue-400", label: "Low" },
  compliant: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Compliant",
  },
  partial: {
    bg: "bg-yellow-500/15",
    text: "text-yellow-300",
    dot: "bg-yellow-400",
    label: "Partial",
  },
  non_compliant: {
    bg: "bg-red-500/15",
    text: "text-red-300",
    dot: "bg-red-400",
    label: "Non-Compliant",
  },
  not_assessed: {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    dot: "bg-gray-400",
    label: "Not Assessed",
  },
  acknowledged: {
    bg: "bg-blue-500/15",
    text: "text-blue-300",
    dot: "bg-blue-400",
    label: "Acknowledged",
  },
  resolved: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Resolved",
  },
  success: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Success",
  },
  rotating: {
    bg: "bg-purple-500/15",
    text: "text-purple-300",
    dot: "bg-purple-400",
    label: "Rotating",
  },
  approved: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
    label: "Approved",
  },
  rejected: { bg: "bg-red-500/15", text: "text-red-300", dot: "bg-red-400", label: "Rejected" },
};

export function StatusBadge({ status, pulse }: StatusBadgeProps) {
  const s = badgeMap[status.toLowerCase()] ?? {
    bg: "bg-gray-500/15",
    text: "text-gray-300",
    dot: "bg-gray-400",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${pulse ? "status-pulse" : ""}`} />
      {s.label}
    </span>
  );
}
