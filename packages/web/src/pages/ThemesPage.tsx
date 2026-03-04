import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Brain } from 'lucide-react';
import { Topbar } from '@/components/layout/Topbar';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SynthesisStatus } from '@/components/themes/SynthesisStatus';
import { ThemeCard } from '@/components/themes/ThemeCard';
import { ThemeDetail } from '@/components/themes/ThemeDetail';
import { useThemesList } from '@/hooks/useThemes';
import type { ThemesQueryParams } from '@/lib/api';

const SORT_OPTIONS = [
  { value: 'opportunityScore', label: 'Opportunity' },
  { value: 'feedbackCount', label: 'Feedback Count' },
  { value: 'avgUrgency', label: 'Urgency' },
  { value: 'avgSentiment', label: 'Sentiment' },
  { value: 'createdAt', label: 'Newest' },
] as const;

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Categories' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'ux_issue', label: 'UX Issue' },
  { value: 'performance', label: 'Performance' },
  { value: 'documentation', label: 'Docs' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'other', label: 'Other' },
];

export function ThemesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  const category = searchParams.get('category') || '';
  const sortBy = (searchParams.get('sortBy') || 'opportunityScore') as ThemesQueryParams['sortBy'];
  const page = parseInt(searchParams.get('page') || '1');

  const queryParams: ThemesQueryParams = useMemo(
    () => ({
      page,
      pageSize: 12,
      category: category || undefined,
      sortBy,
      sortOrder: 'desc',
    }),
    [page, category, sortBy],
  );

  const { data, isLoading, isError, refetch } = useThemesList(queryParams);

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const themes = data?.data || [];
  const pagination = data?.pagination;
  const isEmpty = !isLoading && themes.length === 0;

  return (
    <>
      <Topbar title="Themes" />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <PageContainer>
            <SynthesisStatus />

            {isError ? (
              <div className="text-center py-16">
                <p className="text-sm text-danger mb-4">Failed to load themes</p>
                <Button variant="secondary" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            ) : isEmpty && !category ? (
              <EmptyState
                icon={Brain}
                title="No themes yet"
                description="Import feedback and run synthesis to discover themes."
              />
            ) : (
              <div className="space-y-4 mt-4">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                  <select
                    value={category}
                    onChange={(e) => setParam('category', e.target.value)}
                    className="bg-bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
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

                {/* Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-52 rounded-xl" />
                    ))}
                  </div>
                ) : isEmpty ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-text-secondary mb-4">
                      No themes match this category
                    </p>
                    <Button variant="secondary" onClick={() => setParam('category', '')}>
                      Clear filter
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {themes.map((theme) => (
                      <ThemeCard
                        key={theme.id}
                        theme={theme}
                        onClick={() => setSelectedThemeId(theme.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between text-sm pt-2">
                    <span className="text-text-secondary">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} themes)
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
        {selectedThemeId && (
          <ThemeDetail themeId={selectedThemeId} onClose={() => setSelectedThemeId(null)} />
        )}
      </div>
    </>
  );
}
