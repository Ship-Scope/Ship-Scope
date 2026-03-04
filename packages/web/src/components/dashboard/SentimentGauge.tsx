import type { SentimentDistribution } from '@/lib/api';

export function SentimentGauge({ data }: { data: SentimentDistribution }) {
  const { negative, neutral, positive, total, average } = data;

  if (total === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No sentiment data yet. Run synthesis to analyze feedback.
      </div>
    );
  }

  const negPct = Math.round((negative / total) * 100);
  const neuPct = Math.round((neutral / total) * 100);
  const posPct = 100 - negPct - neuPct;

  const avgColor = average < -0.3 ? 'text-danger' : average > 0.3 ? 'text-success' : 'text-warning';

  return (
    <div>
      <div className="text-center mb-4">
        <span className="text-xs text-text-muted uppercase tracking-wider">Average</span>
        <p className={`text-2xl font-mono font-semibold ${avgColor}`}>
          {average >= 0 ? '+' : ''}
          {average.toFixed(2)}
        </p>
      </div>

      <div className="h-3 flex rounded-full overflow-hidden bg-bg-surface-2">
        {negPct > 0 && (
          <div
            className="h-full bg-danger transition-all duration-500"
            style={{ width: `${negPct}%` }}
          />
        )}
        {neuPct > 0 && (
          <div
            className="h-full bg-warning transition-all duration-500"
            style={{ width: `${neuPct}%` }}
          />
        )}
        {posPct > 0 && (
          <div
            className="h-full bg-success transition-all duration-500"
            style={{ width: `${posPct}%` }}
          />
        )}
      </div>

      <div className="flex justify-between mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <span className="text-text-muted">Negative</span>
          <span className="font-mono text-text-primary">{negative}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span className="text-text-muted">Neutral</span>
          <span className="font-mono text-text-primary">{neutral}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span className="text-text-muted">Positive</span>
          <span className="font-mono text-text-primary">{positive}</span>
        </div>
      </div>
    </div>
  );
}
