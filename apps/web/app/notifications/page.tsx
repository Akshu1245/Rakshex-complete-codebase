"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  ShieldAlert,
  CreditCard,
  Users,
  Activity,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { EmptyState } from "@/components/EmptyState";

const TYPE_META: Record<string, { icon: typeof Bell; color: string }> = {
  scan_complete: { icon: Activity, color: "text-[#06D6A0]" },
  anomaly: { icon: AlertTriangle, color: "text-[#F59E0B]" },
  security: { icon: ShieldAlert, color: "text-[#EF4444]" },
  billing: { icon: CreditCard, color: "text-[#00F0FF]" },
  team: { icon: Users, color: "text-[#3B82F6]" },
  system: { icon: Bell, color: "text-gray-400" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const listQuery = trpc.notifications.list.useQuery({ limit: 50, unreadOnly: false });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.list.invalidate();
      utils.notifications.unreadCount.invalidate();
    },
  });

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const unread = items.filter((n) => !n.read).length;
  const loading = listQuery.isLoading;

  return (
    <div className="text-white p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Bell className="w-8 h-8 text-[#06D6A0]" />
            Notifications
          </h1>
          <p className="text-gray-400 mt-1">
            Scan results, cost anomalies, security alerts, and account activity.
          </p>
        </div>
        <button
          onClick={() => markAllRead.mutate()}
          disabled={unread === 0 || markAllRead.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-[#2D3E50] text-gray-300 hover:text-white hover:border-[#06D6A0]/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all read
        </button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-[#2D3E50] bg-black/50 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState
          icon="🔔"
          title="You're all caught up"
          description="Notifications about your scans, cost anomalies, and security alerts will show up here."
          actions={[{ label: "Run a scan", href: "/scanning" }]}
        />
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((n) => {
            const meta = TYPE_META[n.type] ?? TYPE_META.system;
            const Icon = meta.icon;
            const card = (
              <div
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  n.read ? "border-[#2D3E50] bg-black/30" : "border-[#06D6A0]/40 bg-[#06D6A0]/5"
                }`}
              >
                <div className={`mt-0.5 ${meta.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white text-sm">{n.title}</p>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-[#06D6A0]" />}
                    <span className="text-xs text-gray-500 ml-auto">
                      {timeAgo(n.createdAt as unknown as string)}
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mt-1">{n.body}</p>
                </div>
                {!n.read && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      markRead.mutate({ id: n.id });
                    }}
                    className="text-xs text-gray-500 hover:text-[#06D6A0] shrink-0"
                  >
                    mark read
                  </button>
                )}
              </div>
            );
            return n.link ? (
              <Link
                key={n.id}
                href={n.link}
                onClick={() => !n.read && markRead.mutate({ id: n.id })}
              >
                {card}
              </Link>
            ) : (
              <div key={n.id}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
