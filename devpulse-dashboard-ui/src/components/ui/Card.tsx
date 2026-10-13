import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function Card({ children, className = '', noPadding = false }: CardProps) {
  return (
    <div
      className={`
        bg-zinc-900/50 border border-zinc-800/60 rounded-2xl
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  badge?: { label: string; variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' };
  action?: ReactNode;
}

const badgeStyles = {
  default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export function CardHeader({ title, subtitle, icon, badge, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-[15px] font-semibold text-zinc-100 tracking-tight">{title}</h3>
            {badge && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${badgeStyles[badge.variant || 'default']}`}>
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-800" />
          <div className="space-y-1.5">
            <div className="h-4 w-32 bg-zinc-800 rounded" />
            <div className="h-3 w-20 bg-zinc-800/60 rounded" />
          </div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 bg-zinc-800/40 rounded w-full" style={{ width: `${85 - i * 15}%` }} />
        ))}
      </div>
    </Card>
  );
}
