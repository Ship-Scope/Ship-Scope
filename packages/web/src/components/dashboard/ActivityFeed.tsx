import { Upload, Brain, Lightbulb, FileText, Blocks, Trello, Workflow } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import type { ActivityEntry } from '@/lib/api';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  import: <Upload size={16} className="text-accent-blue" />,
  synthesis: <Brain size={16} className="text-accent-purple" />,
  proposal_generation: <Lightbulb size={16} className="text-warning" />,
  spec_generation: <FileText size={16} className="text-success" />,
  jira_export: <Blocks size={16} className="text-accent-blue" />,
  trello_export: <Trello size={16} className="text-accent-blue" />,
  linear_export: <Workflow size={16} className="text-accent-purple" />,
};

export function ActivityFeed({ activities }: { activities: ActivityEntry[] }) {
  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No activity yet. Import some feedback to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-bg-surface-2 flex items-center justify-center">
            {TYPE_ICONS[activity.type] ?? <FileText size={16} className="text-text-muted" />}
          </div>
          <p className="flex-1 text-sm text-text-primary truncate">{activity.description}</p>
          <time className="flex-shrink-0 text-xs text-text-muted font-mono">
            {formatDate(activity.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
