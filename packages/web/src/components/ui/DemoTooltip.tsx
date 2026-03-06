import { type ReactNode } from 'react';
import { isDemoMode } from '@/hooks/useDemo';

interface DemoTooltipProps {
  children: ReactNode;
}

export function DemoTooltip({ children }: DemoTooltipProps) {
  if (!isDemoMode()) return <>{children}</>;

  return (
    <div className="relative group">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-bg-surface-3 border border-border rounded-lg text-xs text-text-secondary whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        Disabled in demo mode
      </div>
    </div>
  );
}
