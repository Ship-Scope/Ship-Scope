import { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const CHANNELS = [
  { value: '', label: 'All channels' },
  { value: 'support_ticket', label: 'Support' },
  { value: 'interview', label: 'Interview' },
  { value: 'survey', label: 'Survey' },
  { value: 'slack', label: 'Slack' },
  { value: 'app_review', label: 'App Review' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'true', label: 'Processed' },
  { value: 'false', label: 'Unprocessed' },
];

const SENTIMENT_OPTIONS = [
  { value: '', label: 'Any sentiment' },
  { value: 'positive', label: 'Positive (>0.3)' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'negative', label: 'Negative (<-0.3)' },
];

interface FeedbackFiltersProps {
  search: string;
  channel: string;
  processed: string;
  sentiment: string;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onChannelChange: (value: string) => void;
  onProcessedChange: (value: string) => void;
  onSentimentChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onReset: () => void;
}

export function FeedbackFilters({
  search,
  channel,
  processed,
  sentiment,
  dateFrom,
  dateTo,
  onSearchChange,
  onChannelChange,
  onProcessedChange,
  onSentimentChange,
  onDateFromChange,
  onDateToChange,
  onReset,
}: FeedbackFiltersProps) {
  const [searchInput, setSearchInput] = useState(search);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, onSearchChange]);

  // Sync external search changes
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const hasFilters = channel || processed || sentiment || dateFrom || dateTo || search;

  const selectClasses =
    'bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue appearance-none cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-[320px]">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search feedback..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-full bg-bg-surface-2 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue"
        />
      </div>

      <select
        value={channel}
        onChange={(e) => onChannelChange(e.target.value)}
        className={selectClasses}
      >
        {CHANNELS.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <select
        value={processed}
        onChange={(e) => onProcessedChange(e.target.value)}
        className={selectClasses}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        value={sentiment}
        onChange={(e) => onSentimentChange(e.target.value)}
        className={selectClasses}
      >
        {SENTIMENT_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        placeholder="From"
        className={cn(selectClasses, !dateFrom && 'text-text-muted')}
      />

      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        placeholder="To"
        className={cn(selectClasses, !dateTo && 'text-text-muted')}
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X size={14} /> Clear
        </Button>
      )}
    </div>
  );
}
