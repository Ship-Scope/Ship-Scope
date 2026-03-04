import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  trendPercent: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export function StatCard({ label, icon, value, trendPercent, trendDirection }: StatCardProps) {
  const trendColor = {
    up: 'text-success',
    down: 'text-danger',
    flat: 'text-text-muted',
  }[trendDirection];

  const TrendIcon = {
    up: TrendingUp,
    down: TrendingDown,
    flat: Minus,
  }[trendDirection];

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-5 hover:border-border/80 transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-text-muted font-medium">{label}</span>
        <span className="text-text-muted">{icon}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-semibold font-mono text-text-primary">
          {value.toLocaleString()}
        </span>
        <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
          <TrendIcon size={14} />
          <span>{Math.abs(trendPercent)}%</span>
        </div>
      </div>
      <p className="text-xs text-text-muted mt-1">this week</p>
    </div>
  );
}
