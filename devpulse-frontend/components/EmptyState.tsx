"use client";
import Link from "next/link";
import type { ReactNode } from "react";

export interface EmptyStateAction {
  label: string;
  /** External / app-internal href. Use either `href` or `onClick`. */
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export interface EmptyStateProps {
  /**
   * Emoji or inline SVG shown above the title. Kept intentionally small and
   * dependency-free so this component works inside both server and client
   * pages.
   */
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  /** Optional compact mode for in-card empty states (smaller padding). */
  compact?: boolean;
  className?: string;
}

/**
 * Shared empty-state block used across the dashboard. Every list page that
 * can have zero rows should render this instead of a bare "No X yet" line so
 * users get a consistent onboarding experience with actionable next steps.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  compact = false,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        "w-full text-center rounded-lg border border-dashed border-gray-700 bg-gray-900/40",
        compact ? "py-8 px-6" : "py-14 px-6",
        className,
      ].join(" ")}
    >
      {icon && (
        <div
          aria-hidden="true"
          className={[
            "mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-800/80 text-blue-300",
            compact ? "h-10 w-10 text-xl" : "h-14 w-14 text-2xl",
          ].join(" ")}
        >
          {icon}
        </div>
      )}
      <h3
        className={[
          "font-semibold text-gray-100",
          compact ? "text-base" : "text-lg",
        ].join(" ")}
      >
        {title}
      </h3>
      {description && (
        <p
          className={[
            "mx-auto mt-2 text-gray-400",
            compact ? "text-sm max-w-sm" : "text-sm max-w-md",
          ].join(" ")}
        >
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {actions.map((action, idx) => {
            const base =
              "inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors";
            const primary =
              "bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500";
            const secondary =
              "border border-gray-700 text-gray-200 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500";
            const cls = [
              base,
              action.variant === "secondary" ? secondary : primary,
            ].join(" ");

            if (action.href) {
              return (
                <Link key={idx} href={action.href} className={cls}>
                  {action.label}
                </Link>
              );
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={action.onClick}
                className={cls}
              >
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
