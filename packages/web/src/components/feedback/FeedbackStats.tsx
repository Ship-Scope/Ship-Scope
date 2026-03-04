import { useFeedbackStats } from '@/hooks/useFeedback';
import { formatNumber } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

export function FeedbackStats() {
  const { data: stats, isLoading } = useFeedbackStats();

  if (isLoading) {
    return (
      <div className="flex items-center gap-6 px-1 py-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="flex items-center gap-6 text-sm text-text-secondary px-1 py-3">
      <span>
        <span className="font-medium text-text-primary">{formatNumber(stats.total)}</span> total
      </span>
      <span className="text-border">|</span>
      <span>
        <span className="font-medium text-success">{formatNumber(stats.processed)}</span> processed
      </span>
      <span className="text-border">|</span>
      <span>
        <span className="font-medium text-warning">{formatNumber(stats.unprocessed)}</span>{' '}
        unprocessed
      </span>
      {stats.avgSentiment !== null && (
        <>
          <span className="text-border">|</span>
          <span>
            Avg sentiment{' '}
            <span className="font-medium text-text-primary">{stats.avgSentiment.toFixed(2)}</span>
          </span>
        </>
      )}
    </div>
  );
}
