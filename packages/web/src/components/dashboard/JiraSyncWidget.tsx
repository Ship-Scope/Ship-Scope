import { ExternalLink, RefreshCw, Blocks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useJiraDashboard, useJiraSyncAll } from '@/hooks/useJira';

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-text-muted/20 text-text-muted',
  'In Progress': 'bg-accent-blue/20 text-accent-blue',
  'In Review': 'bg-accent-purple/20 text-accent-purple',
  Done: 'bg-success/20 text-success',
  Closed: 'bg-success/20 text-success',
  Resolved: 'bg-success/20 text-success',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || 'bg-bg-surface-2 text-text-secondary';
}

export function JiraSyncWidget() {
  const { data, isLoading } = useJiraDashboard();
  const syncAllMutation = useJiraSyncAll();
  const navigate = useNavigate();

  if (isLoading || !data) return null;

  if (data.totalExported === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Blocks size={28} className="text-text-muted mb-2" />
        <p className="text-sm text-text-secondary mb-1">No proposals exported to Jira yet</p>
        <p className="text-xs text-text-muted mb-3">
          Export proposals or themes from their detail pages, or configure Jira in Settings.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
          Configure Jira
        </Button>
      </div>
    );
  }

  const statusEntries = Object.entries(data.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{data.totalExported}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Exported</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-accent-purple">{data.epicCount}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Epics</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => syncAllMutation.mutate()}
          loading={syncAllMutation.isPending}
          title="Sync all statuses from Jira"
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

      {/* Recent exports */}
      {data.recentExports.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Recent</p>
          {data.recentExports.map((issue) => (
            <div
              key={issue.jiraKey}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
            >
              <a
                href={issue.jiraUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-accent-blue hover:underline flex items-center gap-1"
              >
                {issue.jiraKey}
                <ExternalLink size={9} />
              </a>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(issue.status)}`}
              >
                {issue.status}
              </span>
              <p className="text-xs text-text-secondary truncate flex-1">{issue.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
