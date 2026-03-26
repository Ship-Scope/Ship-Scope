import { ExternalLink, RefreshCw, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useLinearDashboard, useLinearSyncAll } from '@/hooks/useLinear';

const STATUS_COLORS: Record<string, string> = {
  Backlog: 'bg-text-muted/20 text-text-muted',
  Todo: 'bg-text-muted/20 text-text-muted',
  'In Progress': 'bg-accent-blue/20 text-accent-blue',
  'In Review': 'bg-accent-purple/20 text-accent-purple',
  Done: 'bg-success/20 text-success',
  Completed: 'bg-success/20 text-success',
  Cancelled: 'bg-danger/20 text-danger',
};

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: 'bg-danger/20 text-danger',
  High: 'bg-warning/20 text-warning',
  Medium: 'bg-accent-blue/20 text-accent-blue',
  Low: 'bg-text-muted/20 text-text-muted',
  'No Priority': 'bg-bg-surface-2 text-text-secondary',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-bg-surface-2 text-text-secondary';
}

function getPriorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] || 'bg-bg-surface-2 text-text-secondary';
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'No Priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export function LinearSyncWidget() {
  const { data, isLoading } = useLinearDashboard();
  const syncAllMutation = useLinearSyncAll();
  const navigate = useNavigate();

  if (isLoading || !data) return null;

  if (data.totalExported === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Workflow size={28} className="text-text-muted mb-2" />
        <p className="text-sm text-text-secondary mb-1">No proposals exported to Linear yet</p>
        <p className="text-xs text-text-muted mb-3">
          Export proposals or themes from their detail pages, or configure Linear in Settings.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
          Configure Linear
        </Button>
      </div>
    );
  }

  const statusEntries = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]);
  const priorityEntries = Object.entries(data.byPriority).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{data.totalExported}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Issues</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-accent-purple">{statusEntries.length}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">States</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => syncAllMutation.mutate()}
          loading={syncAllMutation.isPending}
          title="Sync all statuses from Linear"
        >
          <RefreshCw size={14} />
          Sync All
        </Button>
      </div>

      {syncAllMutation.data && (
        <p className="text-xs text-success">
          Synced {syncAllMutation.data.synced} issues
          {syncAllMutation.data.autoShipped > 0 &&
            `, ${syncAllMutation.data.autoShipped} auto-shipped`}
        </p>
      )}

      {/* Status breakdown bar */}
      {statusEntries.length > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-2 mb-2">
            {statusEntries.map(([status, count]) => (
              <div
                key={status}
                className={getStatusColor(status).split(' ')[0]}
                style={{ width: `${(count / data.totalExported) * 100}%` }}
                title={`${status}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${getStatusColor(status).split(' ')[0]}`}
                />
                <span className="text-[10px] text-text-muted">
                  {status} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority breakdown */}
      {priorityEntries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {priorityEntries.map(([priority, count]) => (
            <span
              key={priority}
              className={`text-[10px] px-2 py-0.5 rounded-full ${getPriorityColor(priority)}`}
            >
              {priority}: {count}
            </span>
          ))}
        </div>
      )}

      {/* Recent exports */}
      {data.recentExports.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Recent</p>
          {data.recentExports.map((issue) => (
            <div
              key={issue.identifier}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
            >
              <a
                href={issue.linearUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent-blue hover:underline flex items-center gap-1 shrink-0"
              >
                {issue.identifier}
                <ExternalLink size={9} />
              </a>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${getStatusColor(issue.status)}`}
              >
                {issue.status}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${getPriorityColor(PRIORITY_LABELS[issue.priority] || 'No Priority')}`}
              >
                P{issue.priority}
              </span>
              <p className="text-xs text-text-secondary truncate flex-1">{issue.issueTitle}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
