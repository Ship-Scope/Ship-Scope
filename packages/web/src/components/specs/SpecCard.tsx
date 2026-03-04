import { FileText } from 'lucide-react';
import { type SpecItem } from '@/lib/api';

interface SpecCardProps {
  spec: SpecItem;
  isSelected: boolean;
  onClick: () => void;
}

export function SpecCard({ spec, isSelected, onClick }: SpecCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        isSelected
          ? 'border-accent-blue bg-accent-blue/5'
          : 'border-border bg-bg-surface hover:border-border/80 hover:bg-bg-surface/80'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-1.5 rounded-lg bg-accent-blue/10">
          <FileText className="w-4 h-4 text-accent-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-text-primary truncate">{spec.proposal.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-text-muted">v{spec.version}</span>
            {spec.proposal.riceScore !== null && (
              <span className="text-xs text-accent-blue font-medium">
                RICE: {spec.proposal.riceScore.toFixed(1)}
              </span>
            )}
          </div>
          <p className="text-xs text-text-muted mt-1">
            {new Date(spec.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </button>
  );
}
