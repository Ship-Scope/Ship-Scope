import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { getSentimentColor, getUrgencyColor } from '@/lib/utils';
import type { ThemeItem } from '@/lib/api';

interface ThemeCardProps {
  theme: ThemeItem;
  onClick: () => void;
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

export function ThemeCard({ theme, onClick }: ThemeCardProps) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-text-primary leading-tight">{theme.name}</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {theme.jiraEpicKey && <Badge variant="blue">Epic</Badge>}
          {theme.trelloBoardListId && <Badge variant="green">Trello</Badge>}
          {theme.linearProjectId && <Badge variant="purple">Linear</Badge>}
          {theme.category && (
            <Badge variant={categoryVariants[theme.category] || 'gray'}>
              {categoryLabels[theme.category] || theme.category}
            </Badge>
          )}
        </div>
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 mb-4">{theme.description}</p>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-semibold text-text-primary">{theme.feedbackCount}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Items</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${getSentimentColor(theme.avgSentiment)}`}>
            {theme.avgSentiment.toFixed(2)}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Sentiment</p>
        </div>
        <div>
          <p className={`text-lg font-semibold ${getUrgencyColor(theme.avgUrgency)}`}>
            {theme.avgUrgency.toFixed(2)}
          </p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Urgency</p>
        </div>
      </div>

      {theme.painPoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex flex-wrap gap-1">
            {theme.painPoints.slice(0, 3).map((point, i) => (
              <span
                key={i}
                className="text-[10px] bg-bg-surface-2 text-text-secondary px-2 py-0.5 rounded"
              >
                {point}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">Opportunity</span>
        <div className="flex items-center gap-2">
          <div className="w-16 h-1.5 bg-bg-surface-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-blue rounded-full"
              style={{ width: `${Math.min(100, theme.opportunityScore * 10)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-text-primary">
            {theme.opportunityScore.toFixed(1)}
          </span>
        </div>
      </div>
    </Card>
  );
}
