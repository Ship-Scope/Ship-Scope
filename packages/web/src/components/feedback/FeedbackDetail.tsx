import { Trash2 } from 'lucide-react';
import { type FeedbackItem } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getSentimentColor, getUrgencyColor } from '@/lib/utils';

interface FeedbackDetailProps {
  item: FeedbackItem;
  onDelete: (id: string) => void;
}

export function FeedbackDetail({ item, onDelete }: FeedbackDetailProps) {
  return (
    <div className="px-4 py-4 bg-bg-surface-2 border-t border-border animate-fade-up">
      <div className="mb-4">
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
          {item.content}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div>
          <span className="text-text-muted block text-xs mb-1">Author</span>
          <span className="text-text-primary">{item.author || 'Anonymous'}</span>
        </div>
        <div>
          <span className="text-text-muted block text-xs mb-1">Email</span>
          <span className="text-text-primary">{item.email || '—'}</span>
        </div>
        <div>
          <span className="text-text-muted block text-xs mb-1">Source</span>
          <span className="text-text-primary">{item.source.name}</span>
        </div>
        <div>
          <span className="text-text-muted block text-xs mb-1">Created</span>
          <span className="text-text-primary">{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4 text-sm">
        {item.sentiment !== null && (
          <div>
            <span className="text-text-muted text-xs mr-2">Sentiment</span>
            <span className={getSentimentColor(item.sentiment)}>{item.sentiment.toFixed(2)}</span>
          </div>
        )}
        {item.urgency !== null && (
          <div>
            <span className="text-text-muted text-xs mr-2">Urgency</span>
            <span className={getUrgencyColor(item.urgency)}>{item.urgency.toFixed(2)}</span>
          </div>
        )}
        {item.processedAt && (
          <div>
            <span className="text-text-muted text-xs mr-2">Processed</span>
            <span className="text-success text-xs">
              {new Date(item.processedAt).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {item.themes.length > 0 && (
        <div className="mb-4">
          <span className="text-text-muted text-xs block mb-2">Themes</span>
          <div className="flex flex-wrap gap-2">
            {item.themes.map((t) => (
              <Badge key={t.theme.name} variant="blue">
                {t.theme.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button variant="danger" size="sm" onClick={() => onDelete(item.id)}>
          <Trash2 size={14} /> Delete
        </Button>
      </div>
    </div>
  );
}
