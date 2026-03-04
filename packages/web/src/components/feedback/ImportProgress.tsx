import { CheckCircle2, XCircle, MinusCircle, Loader2 } from 'lucide-react';
import { useImportJobStatus } from '@/hooks/useImport';

interface ImportProgressProps {
  jobId: string | null;
  syncResult: { imported: number; skipped: number; errors: number } | null;
}

export function ImportProgress({ jobId, syncResult }: ImportProgressProps) {
  const { data: jobStatus } = useImportJobStatus(jobId);

  // Sync result (small files processed immediately)
  if (syncResult) {
    return (
      <div className="space-y-4">
        <div className="text-center py-2">
          <CheckCircle2 size={40} className="mx-auto text-success mb-3" />
          <p className="text-sm font-medium text-text-primary">Import Complete</p>
        </div>
        <ResultCounters
          imported={syncResult.imported}
          skipped={syncResult.skipped}
          errors={syncResult.errors}
        />
      </div>
    );
  }

  // Async job with polling
  if (!jobStatus) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-accent-blue" />
        <span className="ml-3 text-sm text-text-secondary">Starting import...</span>
      </div>
    );
  }

  const progress = jobStatus.progress || 0;
  const isComplete = jobStatus.status === 'completed';
  const isFailed = jobStatus.status === 'failed';

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">
            {isComplete
              ? 'Import complete'
              : isFailed
                ? 'Import failed'
                : `Processing... ${progress}%`}
          </span>
          <span className="text-sm font-medium text-text-primary">{progress}%</span>
        </div>
        <div className="h-2 bg-bg-surface-2 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isFailed ? 'bg-danger' : isComplete ? 'bg-success' : 'bg-accent-blue'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Result counters */}
      {(isComplete || isFailed) && jobStatus.result && (
        <ResultCounters
          imported={jobStatus.result.processed}
          skipped={0}
          errors={jobStatus.result.errors}
        />
      )}

      {/* Error details */}
      {jobStatus.errors && jobStatus.errors.length > 0 && (
        <div className="text-xs text-text-muted bg-bg-surface-2 rounded-lg p-3 max-h-32 overflow-y-auto">
          {jobStatus.errors.slice(0, 5).map((err, i) => (
            <p key={i}>{err}</p>
          ))}
          {jobStatus.errors.length > 5 && (
            <p className="mt-1">...and {jobStatus.errors.length - 5} more</p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultCounters({
  imported,
  skipped,
  errors,
}: {
  imported: number;
  skipped: number;
  errors: number;
}) {
  return (
    <div className="flex items-center gap-6 text-sm">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={16} className="text-success" />
        <span className="text-text-primary">{imported} imported</span>
      </div>
      {skipped > 0 && (
        <div className="flex items-center gap-2">
          <MinusCircle size={16} className="text-warning" />
          <span className="text-text-primary">{skipped} skipped</span>
        </div>
      )}
      {errors > 0 && (
        <div className="flex items-center gap-2">
          <XCircle size={16} className="text-danger" />
          <span className="text-text-primary">{errors} errors</span>
        </div>
      )}
    </div>
  );
}
