"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";

/**
 * Header bell with a live unread badge. Polls the notifications proxy route
 * and links to the full feed at /notifications. On this deployment the
 * notifications backend isn't connected, so no badge is shown — a missing
 * badge means no data, not zero unread.
 */
export function NotificationBell() {
  const { data } = useApi<{ count: number }>("/api/notifications?kind=unreadCount");
  const count = data?.count ?? 0;

  return (
    <Link
      href="/notifications"
      className="relative text-on-surface-variant hover:text-primary transition-colors"
      aria-label={count > 0 ? `${count} unread notifications` : "Notifications"}
    >
      <span className="material-symbols-outlined cursor-pointer">notifications</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
