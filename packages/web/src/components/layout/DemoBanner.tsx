import { useState } from 'react';
import { X, Eye } from 'lucide-react';
import { isDemoMode } from '@/hooks/useDemo';

const DISMISSED_KEY = 'shipscope-demo-banner-dismissed';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISSED_KEY) === '1');

  if (!isDemoMode() || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="bg-accent-blue/10 border-b border-accent-blue/20 px-4 py-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Eye size={14} className="text-accent-blue flex-shrink-0" />
        <p className="text-xs text-text-primary truncate">
          <span className="font-medium text-accent-blue">Demo Mode</span>
          {' — '}
          You&apos;re viewing sample data. Mutations are disabled.{' '}
          <a
            href="https://github.com/Ship-Scope/Ship-Scope"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            Self-host ShipScope
          </a>{' '}
          to use your own data.
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className="text-text-secondary hover:text-text-primary p-0.5 rounded flex-shrink-0"
        aria-label="Dismiss banner"
      >
        <X size={14} />
      </button>
    </div>
  );
}
