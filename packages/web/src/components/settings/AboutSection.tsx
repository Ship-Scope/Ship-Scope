import { ExternalLink } from 'lucide-react';

export function AboutSection() {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-1">ShipScope</h4>
        <p className="text-xs text-text-muted">
          Version 0.1.0 &middot; Feedback Intelligence Platform
        </p>
      </div>

      <div className="space-y-2">
        <a
          href="https://github.com/Ship-Scope/shipscope"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-accent-blue hover:text-accent-blue/80 transition-colors"
        >
          <ExternalLink size={14} />
          GitHub Repository
        </a>
      </div>
    </div>
  );
}
