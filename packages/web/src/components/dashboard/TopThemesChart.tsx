import type { TopTheme } from '@/lib/api';

const CATEGORY_COLORS: Record<string, string> = {
  bug: '#FB7185',
  feature_request: '#3B82F6',
  ux_issue: '#FBBF24',
  performance: '#F97316',
  integration: '#818CF8',
  default: '#8B95A5',
};

export function TopThemesChart({ themes }: { themes: TopTheme[] }) {
  if (themes.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted text-sm">
        No themes yet. Run synthesis to discover themes.
      </div>
    );
  }

  const maxCount = Math.max(...themes.map((t) => t.feedbackCount), 1);

  return (
    <div className="space-y-3">
      {themes.map((theme) => {
        const widthPercent = (theme.feedbackCount / maxCount) * 100;
        const color = CATEGORY_COLORS[theme.category ?? 'default'] ?? CATEGORY_COLORS.default;

        return (
          <div key={theme.id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-text-primary truncate max-w-[70%]">{theme.name}</span>
              <span className="text-xs font-mono text-text-muted">{theme.feedbackCount}</span>
            </div>
            <div className="h-2 bg-bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${widthPercent}%`, backgroundColor: color, opacity: 0.8 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
