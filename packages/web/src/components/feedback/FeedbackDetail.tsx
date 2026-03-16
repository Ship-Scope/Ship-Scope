import { Trash2 } from 'lucide-react';
import { type FeedbackItem } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SlideOver } from '@/components/ui/SlideOver';
import { getSentimentColor, getUrgencyColor } from '@/lib/utils';

interface FeedbackDetailProps {
  item: FeedbackItem | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function FeedbackDetail({ item, open, onClose, onDelete }: FeedbackDetailProps) {
  if (!item) return null;

  return (
    <SlideOver open={open} onClose={onClose} title="Feedback Detail">
      <div className="px-5 py-5 space-y-6">
        {/* Content */}
        <div>
          <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Content
          </h4>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {item.content}
          </p>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-4">
          <MetaField label="Author" value={item.author || 'Anonymous'} />
          <MetaField label="Email" value={item.email || '—'} />
          <MetaField label="Source" value={item.source.name} />
          <MetaField label="Created" value={new Date(item.createdAt).toLocaleDateString()} />
        </div>

        {/* Scores */}
        <div className="flex items-center gap-6">
          {item.sentiment !== null && (
            <div>
              <span className="text-text-muted text-xs block mb-1">Sentiment</span>
              <span className={`text-sm font-medium ${getSentimentColor(item.sentiment)}`}>
                {item.sentiment.toFixed(2)}
              </span>
            </div>
          )}
          {item.urgency !== null && (
            <div>
              <span className="text-text-muted text-xs block mb-1">Urgency</span>
              <span className={`text-sm font-medium ${getUrgencyColor(item.urgency)}`}>
                {item.urgency.toFixed(2)}
              </span>
            </div>
          )}
          {item.processedAt && (
            <div>
              <span className="text-text-muted text-xs block mb-1">Processed</span>
              <span className="text-success text-sm">
                {new Date(item.processedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Themes */}
        {item.themes.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
              Themes
            </h4>
            <div className="flex flex-wrap gap-2">
              {item.themes.map((t) => (
                <Badge key={t.theme.name} variant="blue">
                  {t.theme.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onDelete(item.id);
              onClose();
            }}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>
    </SlideOver>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-text-muted block text-xs mb-1">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
