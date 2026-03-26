import { X, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { getSentimentColor, getUrgencyColor } from '@/lib/utils';
import { useThemeDetail } from '@/hooks/useThemes';
import { useJiraExportTheme } from '@/hooks/useJira';
import { useTrelloExportTheme } from '@/hooks/useTrello';
import { useLinearExportTheme } from '@/hooks/useLinear';

interface ThemeDetailProps {
  themeId: string;
  onClose: () => void;
}

const categoryLabels: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  ux_issue: 'UX Issue',
  performance: 'Performance',
  documentation: 'Docs',
  pricing: 'Pricing',
  other: 'Other',
};

const categoryVariants: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'gray'> = {
  bug: 'red',
  feature_request: 'blue',
  ux_issue: 'yellow',
  performance: 'red',
  documentation: 'gray',
  pricing: 'green',
  other: 'gray',
};

export function ThemeDetail({ themeId, onClose }: ThemeDetailProps) {
  const { data: theme, isLoading } = useThemeDetail(themeId);
  const epicExportMutation = useJiraExportTheme();
  const trelloExportMutation = useTrelloExportTheme();
  const linearExportMutation = useLinearExportTheme();

  if (isLoading) {
    return (
      <div className="w-[400px] border-l border-border bg-bg-surface p-6 space-y-4 overflow-y-auto">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!theme) return null;

  return (
    <div className="w-[400px] border-l border-border bg-bg-surface overflow-y-auto">
      <div className="sticky top-0 z-10 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary truncate pr-2">{theme.name}</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Category & Scores */}
        <div className="flex items-center gap-2 flex-wrap">
          {theme.category && (
            <Badge variant={categoryVariants[theme.category] || 'gray'}>
              {categoryLabels[theme.category] || theme.category}
            </Badge>
          )}
          <Badge variant="gray">{theme.feedbackCount} items</Badge>
        </div>

        <p className="text-sm text-text-secondary">{theme.description}</p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBlock
            label="Avg Sentiment"
            value={theme.avgSentiment.toFixed(2)}
            colorClass={getSentimentColor(theme.avgSentiment)}
          />
          <StatBlock
            label="Avg Urgency"
            value={theme.avgUrgency.toFixed(2)}
            colorClass={getUrgencyColor(theme.avgUrgency)}
          />
          <StatBlock
            label="Opportunity"
            value={theme.opportunityScore.toFixed(1)}
            colorClass="text-accent-blue"
          />
          <StatBlock
            label="Feedback Items"
            value={String(theme.feedbackCount)}
            colorClass="text-text-primary"
          />
        </div>

        {/* Pain Points */}
        {theme.painPoints.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Pain Points
            </h4>
            <ul className="space-y-1">
              {theme.painPoints.map((point, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-danger mt-1">&#8226;</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Jira Epic Export */}
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Jira Integration
          </h4>
          {theme.jiraEpicKey ? (
            <div className="bg-bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Linked as Epic:</span>
                <a
                  href={theme.jiraEpicUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-mono text-accent-blue hover:underline flex items-center gap-1"
                >
                  {theme.jiraEpicKey}
                  <ExternalLink size={10} />
                </a>
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => epicExportMutation.mutate(themeId)}
              loading={epicExportMutation.isPending}
            >
              Export as Jira Epic
            </Button>
          )}
          {epicExportMutation.isSuccess && epicExportMutation.data && (
            <p className="text-xs text-success mt-2">
              Created Epic {epicExportMutation.data.epicKey} with{' '}
              {epicExportMutation.data.storiesCreated} stories
            </p>
          )}
          {epicExportMutation.isError && (
            <p className="text-xs text-danger mt-2">
              Export failed. Check your Jira configuration in Settings.
            </p>
          )}
        </div>

        {/* Trello List Export */}
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Trello Integration
          </h4>
          {theme.trelloBoardListId ? (
            <div className="bg-bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Linked as List:</span>
                {theme.trelloBoardListUrl ? (
                  <a
                    href={theme.trelloBoardListUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-blue hover:underline flex items-center gap-1"
                  >
                    View Board
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-sm text-text-secondary">Exported</span>
                )}
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => trelloExportMutation.mutate(themeId)}
              loading={trelloExportMutation.isPending}
            >
              Export as Trello List
            </Button>
          )}
          {trelloExportMutation.isSuccess && trelloExportMutation.data && (
            <p className="text-xs text-success mt-2">
              Created list &ldquo;{trelloExportMutation.data.listName}&rdquo; with{' '}
              {trelloExportMutation.data.cardsCreated} cards
            </p>
          )}
          {trelloExportMutation.isError && (
            <p className="text-xs text-danger mt-2">
              Export failed. Check your Trello configuration in Settings.
            </p>
          )}
        </div>

        {/* Linear Project Export */}
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Linear Integration
          </h4>
          {theme.linearProjectId ? (
            <div className="bg-bg-surface-2 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Linked as Project:</span>
                {theme.linearProjectUrl ? (
                  <a
                    href={theme.linearProjectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-blue hover:underline flex items-center gap-1"
                  >
                    View Project
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-sm text-text-secondary">Exported</span>
                )}
              </div>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => linearExportMutation.mutate(themeId)}
              loading={linearExportMutation.isPending}
            >
              Export as Linear Project
            </Button>
          )}
          {linearExportMutation.isSuccess && linearExportMutation.data && (
            <p className="text-xs text-success mt-2">
              Created project &ldquo;{linearExportMutation.data.projectName}&rdquo; with{' '}
              {linearExportMutation.data.issuesCreated} issues
            </p>
          )}
          {linearExportMutation.isError && (
            <p className="text-xs text-danger mt-2">
              Export failed. Check your Linear configuration in Settings.
            </p>
          )}
        </div>

        {/* Linked Feedback */}
        {theme.feedbackItems && theme.feedbackItems.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Linked Feedback ({theme.feedbackItems.length})
            </h4>
            <div className="space-y-2">
              {theme.feedbackItems.map((link) => (
                <div key={link.feedbackItem.id} className="bg-bg-surface-2 rounded-lg p-3 text-sm">
                  <p className="text-text-primary line-clamp-3">{link.feedbackItem.content}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-muted">
                    {link.feedbackItem.author && <span>{link.feedbackItem.author}</span>}
                    {link.feedbackItem.sentiment !== null && (
                      <span className={getSentimentColor(link.feedbackItem.sentiment)}>
                        S: {link.feedbackItem.sentiment.toFixed(1)}
                      </span>
                    )}
                    {link.feedbackItem.urgency !== null && (
                      <span className={getUrgencyColor(link.feedbackItem.urgency)}>
                        U: {link.feedbackItem.urgency.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="bg-bg-surface-2 rounded-lg p-3">
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}
