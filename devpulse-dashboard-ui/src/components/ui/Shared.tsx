import { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  purple: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function Badge({ variant = 'default', children, dot, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${styles[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${
          variant === 'success' ? 'bg-emerald-400' :
          variant === 'danger' ? 'bg-red-400' :
          variant === 'warning' ? 'bg-amber-400' :
          variant === 'info' ? 'bg-blue-400' :
          variant === 'purple' ? 'bg-violet-400' :
          'bg-zinc-400'
        }`} />
      )}
      {children}
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; up: boolean };
  accent?: string;
}

export function MetricCard({ label, value, subtitle, icon, trend, accent = 'text-white' }: MetricCardProps) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-2xl p-5 hover:border-zinc-700/60 transition-colors group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-400 group-hover:border-zinc-600/60 transition-colors">
          {icon}
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${accent}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
        {trend && (
          <span className={`text-xs font-medium ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend.up ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-zinc-500 mb-4">
        {icon}
      </div>
      <h3 className="text-sm font-medium text-zinc-300 mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  showValues?: boolean;
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max, label, showValues = true, size = 'sm' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="space-y-1.5">
      {label && <span className="text-xs text-zinc-500">{label}</span>}
      <div className={`${h} rounded-full bg-zinc-800 overflow-hidden`}>
        <div className={`${h} rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showValues && (
        <div className="flex justify-between text-[11px] text-zinc-500">
          <span>{typeof value === 'number' ? value.toLocaleString() : value}</span>
          <span>{typeof max === 'number' ? max.toLocaleString() : max}</span>
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, subtitle, icon, action }: { title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        {icon && <span className="text-zinc-400">{icon}</span>}
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
