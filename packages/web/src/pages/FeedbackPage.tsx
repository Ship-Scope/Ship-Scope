import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Upload, Trash2, CheckCircle2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { FeedbackStats } from '@/components/feedback/FeedbackStats';
import { FeedbackFilters } from '@/components/feedback/FeedbackFilters';
import { FeedbackTable } from '@/components/feedback/FeedbackTable';
import { ImportModal } from '@/components/feedback/ImportModal';
import {
  useFeedbackList,
  useDeleteFeedback,
  useBulkDeleteFeedback,
  useMarkProcessed,
} from '@/hooks/useFeedback';
import type { FeedbackQueryParams } from '@/lib/api';

function parseSentimentFilter(value: string): { min?: number; max?: number } {
  if (value === 'positive') return { min: 0.3 };
  if (value === 'negative') return { max: -0.3 };
  if (value === 'neutral') return { min: -0.3, max: 0.3 };
  return {};
}

export default function FeedbackPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Read filters from URL
  const page = parseInt(searchParams.get('page') || '1');
  const search = searchParams.get('search') || '';
  const channel = searchParams.get('channel') || '';
  const processed = searchParams.get('processed') || '';
  const sentiment = searchParams.get('sentiment') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const sortBy = (searchParams.get('sortBy') || 'createdAt') as
    | 'createdAt'
    | 'sentiment'
    | 'urgency';
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

  const sentimentRange = parseSentimentFilter(sentiment);

  const queryParams: FeedbackQueryParams = useMemo(
    () => ({
      page,
      pageSize: 50,
      search: search || undefined,
      channel: channel || undefined,
      processed: (processed as 'true' | 'false') || undefined,
      sentimentMin: sentimentRange.min,
      sentimentMax: sentimentRange.max,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      sortOrder,
    }),
    [
      page,
      search,
      channel,
      processed,
      sentimentRange.min,
      sentimentRange.max,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
    ],
  );

  const { data, isLoading, isError, refetch } = useFeedbackList(queryParams);
  const deleteMutation = useDeleteFeedback();
  const bulkDeleteMutation = useBulkDeleteFeedback();
  const markProcessedMutation = useMarkProcessed();

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        // Reset to page 1 on filter change (except page itself)
        if (key !== 'page') next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const resetFilters = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const handleSort = useCallback(
    (column: string) => {
      if (sortBy === column) {
        setParam('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setParam('sortBy', column);
        setParam('sortOrder', 'desc');
      }
    },
    [sortBy, sortOrder, setParam],
  );

  const handleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!data?.data) return;
    const allIds = data.data.map((item) => item.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [data, selectedIds]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this feedback item?')) return;
      await deleteMutation.mutateAsync(id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [deleteMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Delete ${ids.length} feedback items?`)) return;
    await bulkDeleteMutation.mutateAsync(ids);
    setSelectedIds(new Set());
  }, [selectedIds, bulkDeleteMutation]);

  const handleMarkProcessed = useCallback(async () => {
    const ids = Array.from(selectedIds);
    await markProcessedMutation.mutateAsync(ids);
    setSelectedIds(new Set());
  }, [selectedIds, markProcessedMutation]);

  const items = data?.data || [];
  const pagination = data?.pagination;
  const isEmpty = !isLoading && items.length === 0;
  const hasFilters = search || channel || processed || sentiment || dateFrom || dateTo;

  return (
    <>
      <Topbar
        title="Feedback"
        actions={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload size={16} /> Import
            </Button>
          </div>
        }
      />
      <PageContainer>
        {isError ? (
          <div className="text-center py-16">
            <p className="text-sm text-danger mb-4">Failed to load feedback</p>
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : isEmpty && !hasFilters ? (
          <EmptyState
            icon={MessageSquare}
            title="No feedback yet"
            description="Import your first feedback to get started with ShipScope."
            action={{ label: 'Import Feedback', onClick: () => setImportOpen(true) }}
          />
        ) : (
          <div className="space-y-4">
            <FeedbackStats />
            <FeedbackFilters
              search={search}
              channel={channel}
              processed={processed}
              sentiment={sentiment}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onSearchChange={(v) => setParam('search', v)}
              onChannelChange={(v) => setParam('channel', v)}
              onProcessedChange={(v) => setParam('processed', v)}
              onSentimentChange={(v) => setParam('sentiment', v)}
              onDateFromChange={(v) => setParam('dateFrom', v)}
              onDateToChange={(v) => setParam('dateTo', v)}
              onReset={resetFilters}
            />

            {isEmpty && hasFilters ? (
              <div className="text-center py-12">
                <p className="text-sm text-text-secondary mb-4">No feedback matches your filters</p>
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <FeedbackTable
                items={items}
                isLoading={isLoading}
                selectedIds={selectedIds}
                onSelectId={handleSelectId}
                onSelectAll={handleSelectAll}
                onDelete={handleDelete}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
              />
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}-
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                  {pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setParam('page', String(pagination.page - 1))}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (pagination.page <= 4) {
                      pageNum = i + 1;
                    } else if (pagination.page >= pagination.totalPages - 3) {
                      pageNum = pagination.totalPages - 6 + i;
                    } else {
                      pageNum = pagination.page - 3 + i;
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.page ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => setParam('page', String(pageNum))}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setParam('page', String(pagination.page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}

            {/* Bulk action bar */}
            {selectedIds.size > 0 && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-bg-surface-3 border border-border rounded-xl shadow-lg px-6 py-3 flex items-center gap-4">
                <span className="text-sm text-text-primary font-medium">
                  {selectedIds.size} selected
                </span>
                <div className="h-5 w-px bg-border" />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleBulkDelete}
                  loading={bulkDeleteMutation.isPending}
                >
                  <Trash2 size={14} /> Delete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleMarkProcessed}
                  loading={markProcessedMutation.isPending}
                >
                  <CheckCircle2 size={14} /> Mark Processed
                </Button>
              </div>
            )}
          </div>
        )}
      </PageContainer>

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
