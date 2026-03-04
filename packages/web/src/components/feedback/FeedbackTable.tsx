import { useState, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { FeedbackRow } from './FeedbackRow';
import { FeedbackDetail } from './FeedbackDetail';
import { type FeedbackItem } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils';

interface FeedbackTableProps {
  items: FeedbackItem[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectId: (id: string) => void;
  onSelectAll: () => void;
  onDelete: (id: string) => void;
  sortBy: string;
  sortOrder: string;
  onSort: (column: string) => void;
}

function SortIndicator({
  column,
  sortBy,
  sortOrder,
}: {
  column: string;
  sortBy: string;
  sortOrder: string;
}) {
  if (column !== sortBy) return null;
  return sortOrder === 'asc' ? (
    <ChevronUp size={14} className="inline ml-1" />
  ) : (
    <ChevronDown size={14} className="inline ml-1" />
  );
}

export function FeedbackTable({
  items,
  isLoading,
  selectedIds,
  onSelectId,
  onSelectAll,
  onDelete,
  sortBy,
  sortOrder,
  onSort,
}: FeedbackTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const thClass =
    'px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider';
  const sortableClass = 'cursor-pointer hover:text-text-primary transition-colors select-none';

  if (isLoading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-border rounded-xl">
      <table className="w-full">
        <thead className="bg-bg-surface-2">
          <tr className="border-b border-border">
            <th className={cn(thClass, 'w-10')}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-border bg-bg-surface accent-accent-blue cursor-pointer"
              />
            </th>
            <th className={thClass}>Content</th>
            <th className={thClass}>Author</th>
            <th className={thClass}>Channel</th>
            <th className={cn(thClass, sortableClass)} onClick={() => onSort('sentiment')}>
              Sentiment
              <SortIndicator column="sentiment" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
            <th className={cn(thClass, sortableClass)} onClick={() => onSort('createdAt')}>
              Date
              <SortIndicator column="createdAt" sortBy={sortBy} sortOrder={sortOrder} />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              selected={selectedIds.has(item.id)}
              expanded={expandedId === item.id}
              onSelect={onSelectId}
              onToggle={toggleExpand}
            />
          ))}
          {items.map(
            (item) =>
              expandedId === item.id && (
                <tr key={`${item.id}-detail`}>
                  <td colSpan={6}>
                    <FeedbackDetail item={item} onDelete={onDelete} />
                  </td>
                </tr>
              ),
          )}
        </tbody>
      </table>
    </div>
  );
}
