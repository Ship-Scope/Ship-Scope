import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lightbulb, Sparkles } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProposalCard } from '@/components/proposals/ProposalCard';
import { ProposalDetail } from '@/components/proposals/ProposalDetail';
import { useProposalsList, useGenerateProposals } from '@/hooks/useProposals';
import { DemoTooltip } from '@/components/ui/DemoTooltip';
import type { ProposalsQueryParams } from '@/lib/api';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'shipped', label: 'Shipped' },
];

const SORT_OPTIONS = [
  { value: 'riceScore', label: 'RICE Score' },
  { value: 'createdAt', label: 'Newest' },
  { value: 'impactScore', label: 'Impact' },
  { value: 'effortScore', label: 'Effort' },
] as const;

export default function ProposalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const status = searchParams.get('status') || '';
  const sortBy = (searchParams.get('sortBy') || 'riceScore') as ProposalsQueryParams['sortBy'];
  const search = searchParams.get('search') || '';
  const page = parseInt(searchParams.get('page') || '1');

  const queryParams: ProposalsQueryParams = useMemo(
    () => ({
      page,
      pageSize: 12,
      status: status || undefined,
      sortBy,
      sortOrder: 'desc',
      search: search || undefined,
    }),
    [page, status, sortBy, search],
  );

  const { data, isLoading, isError, refetch } = useProposalsList(queryParams);
  const generateMutation = useGenerateProposals();

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const proposals = data?.data || [];
  const pagination = data?.pagination;
  const isEmpty = !isLoading && proposals.length === 0;

  return (
    <>
      <Topbar
        title="Proposals"
        actions={
          <DemoTooltip>
            <Button
              onClick={() => generateMutation.mutate(undefined)}
              loading={generateMutation.isPending}
              size="sm"
            >
              <Sparkles size={14} />
              Generate Proposals
            </Button>
          </DemoTooltip>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <PageContainer>
            {isError ? (
              <div className="text-center py-16">
                <p className="text-sm text-danger mb-4">Failed to load proposals</p>
                <Button variant="secondary" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : isEmpty && !status && !search ? (
              <EmptyState
                icon={Lightbulb}
                title="No proposals yet"
                description="Run synthesis to discover themes, then generate feature proposals."
                action={{
                  label: 'Generate Proposals',
                  onClick: () => generateMutation.mutate(undefined),
                }}
              />
            ) : (
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <input
                    type="text"
                    placeholder="Search proposals..."
                    value={search}
                    onChange={(e) => setParam('search', e.target.value)}
                    className="bg-bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary w-56 placeholder:text-text-muted"
                  />
                  <select
                    value={status}
                    onChange={(e) => setParam('status', e.target.value)}
                    className="bg-bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={sortBy}
                    onChange={(e) => setParam('sortBy', e.target.value)}
                    className="bg-bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        Sort: {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Generation result banner */}
                {generateMutation.isSuccess && (
                  <div className="bg-success-dim text-success rounded-lg px-4 py-2 text-sm">
                    Generated {generateMutation.data.proposalsCreated} proposals
                    {generateMutation.data.proposalsSkipped > 0 &&
                      `, skipped ${generateMutation.data.proposalsSkipped}`}
                    {generateMutation.data.errors.length > 0 &&
                      `, ${generateMutation.data.errors.length} errors`}
                  </div>
                )}

                {/* Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-44 rounded-xl" />
                    ))}
                  </div>
                ) : isEmpty ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-text-secondary mb-4">
                      No proposals match your filters
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setParam('status', '');
                        setParam('search', '');
                      }}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {proposals.map((proposal) => (
                      <ProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        onClick={() => setSelectedId(proposal.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm pt-2">
                    <span className="text-text-secondary">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total}{' '}
                      proposals)
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
              </div>
            )}
          </PageContainer>
        </div>

        {/* Detail panel */}
        {selectedId && (
          <ProposalDetail proposalId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </>
  );
}
