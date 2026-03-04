import { StatusBadge } from './StatusBadge';
import { RICEScoreDisplay } from './RICEScoreDisplay';
import { Card } from '@/components/ui/Card';
import type { ProposalItem } from '@/lib/api';

interface ProposalCardProps {
  proposal: ProposalItem;
  onClick: () => void;
}

export function ProposalCard({ proposal, onClick }: ProposalCardProps) {
  return (
    <Card hover onClick={onClick}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-medium text-text-primary leading-tight line-clamp-2">
          {proposal.title}
        </h3>
        <StatusBadge status={proposal.status} />
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 mb-3">{proposal.problem}</p>

      {proposal.theme && (
        <p className="text-[10px] text-text-muted mb-3">
          Theme: <span className="text-text-secondary">{proposal.theme.name}</span>
        </p>
      )}

      <div className="flex items-center justify-between">
        <RICEScoreDisplay
          reach={proposal.reachScore}
          impact={proposal.impactScore}
          confidence={proposal.confidenceScore}
          effort={proposal.effortScore}
          riceScore={proposal.riceScore}
          compact
        />
        <span className="text-[10px] text-text-muted">{proposal.evidenceCount} evidence</span>
      </div>
    </Card>
  );
}
