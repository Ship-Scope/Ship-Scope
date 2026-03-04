import { type FeedbackItem } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { truncate, formatDate, getSentimentColor } from '@/lib/utils';

const CHANNEL_LABELS: Record<
  string,
  { label: string; variant: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }
> = {
  support_ticket: { label: 'Support', variant: 'red' },
  interview: { label: 'Interview', variant: 'blue' },
  survey: { label: 'Survey', variant: 'green' },
  slack: { label: 'Slack', variant: 'yellow' },
  app_review: { label: 'Review', variant: 'gray' },
  manual: { label: 'Manual', variant: 'gray' },
  other: { label: 'Other', variant: 'gray' },
};

interface FeedbackRowProps {
  item: FeedbackItem;
  selected: boolean;
  expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

export function FeedbackRow({ item, selected, expanded, onSelect, onToggle }: FeedbackRowProps) {
  const channelInfo = CHANNEL_LABELS[item.channel || 'other'] || CHANNEL_LABELS.other;

  return (
    <tr
      className={`border-b border-border hover:bg-bg-surface-2 transition-colors cursor-pointer ${expanded ? 'bg-bg-surface-2' : ''}`}
      onClick={() => onToggle(item.id)}
    >
      <td className="px-4 py-3 w-10" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect(item.id)}
          className="w-4 h-4 rounded border-border bg-bg-surface-2 accent-accent-blue cursor-pointer"
        />
      </td>
      <td className="px-4 py-3 max-w-[400px]">
        <span className="text-sm text-text-primary">{truncate(item.content, 100)}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-text-secondary">{item.author || 'Anonymous'}</span>
      </td>
      <td className="px-4 py-3">
        <Badge variant={channelInfo.variant}>{channelInfo.label}</Badge>
      </td>
      <td className="px-4 py-3">
        {item.sentiment !== null ? (
          <span className={`text-sm font-medium ${getSentimentColor(item.sentiment)}`}>
            {item.sentiment.toFixed(1)}
          </span>
        ) : (
          <span className="text-sm text-text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-text-secondary whitespace-nowrap">
          {formatDate(item.createdAt)}
        </span>
      </td>
    </tr>
  );
}
