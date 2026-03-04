import { X, Check, XCircle, Rocket, RotateCcw, FileText } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { RICEScoreDisplay } from './RICEScoreDisplay';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useProposalDetail, useUpdateProposal, useDeleteProposal } from '@/hooks/useProposals';
import { useGenerateSpec, useSpecByProposal } from '@/hooks/useSpecs';
import { getSentimentColor, getUrgencyColor } from '@/lib/utils';

interface ProposalDetailProps {
  proposalId: string;
  onClose: () => void;
}

const STATUS_ACTIONS: Record<
  string,
  {
    label: string;
    next: string;
    icon: typeof Check;
    variant: 'primary' | 'secondary' | 'danger' | 'ghost';
  }[]
> = {
  proposed: [
    { label: 'Approve', next: 'approved', icon: Check, variant: 'primary' },
    { label: 'Reject', next: 'rejected', icon: XCircle, variant: 'danger' },
  ],
  approved: [
    { label: 'Ship', next: 'shipped', icon: Rocket, variant: 'primary' },
    { label: 'Reject', next: 'rejected', icon: XCircle, variant: 'danger' },
  ],
  rejected: [{ label: 'Reconsider', next: 'proposed', icon: RotateCcw, variant: 'secondary' }],
  shipped: [],
};

export function ProposalDetail({ proposalId, onClose }: ProposalDetailProps) {
  const { data: proposal, isLoading } = useProposalDetail(proposalId);
  const updateMutation = useUpdateProposal();
  const deleteMutation = useDeleteProposal();
  const generateSpecMutation = useGenerateSpec();
  const { data: existingSpec } = useSpecByProposal(proposalId);

  if (isLoading) {
    return (
      <div className="w-[420px] border-l border-border bg-bg-surface p-6 space-y-4 overflow-y-auto">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!proposal) return null;

  const actions = STATUS_ACTIONS[proposal.status] || [];

  return (
    <div className="w-[420px] border-l border-border bg-bg-surface overflow-y-auto">
      <div className="sticky top-0 z-10 bg-bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-base font-semibold text-text-primary truncate">{proposal.title}</h3>
          <StatusBadge status={proposal.status} />
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* Status Actions */}
        {actions.length > 0 && (
          <div className="flex items-center gap-2">
            {actions.map((action) => (
              <Button
                key={action.next}
                variant={action.variant}
                size="sm"
                loading={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({ id: proposal.id, data: { status: action.next } })
                }
              >
                <action.icon size={14} />
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Generate Spec */}
        {proposal.status === 'approved' && (
          <div>
            {existingSpec ? (
              <p className="text-xs text-text-muted">
                <FileText className="w-3 h-3 inline mr-1" />
                Spec v{existingSpec.version} generated &middot;{' '}
                <button
                  className="text-accent-blue hover:underline"
                  onClick={() => generateSpecMutation.mutate(proposal.id)}
                  disabled={generateSpecMutation.isPending}
                >
                  {generateSpecMutation.isPending ? 'Regenerating...' : 'Regenerate'}
                </button>
              </p>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                loading={generateSpecMutation.isPending}
                onClick={() => generateSpecMutation.mutate(proposal.id)}
              >
                <FileText size={14} />
                Generate Spec
              </Button>
            )}
          </div>
        )}

        {/* Theme */}
        {proposal.theme && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Theme</p>
            <p className="text-sm text-text-primary">{proposal.theme.name}</p>
          </div>
        )}

        {/* Problem & Solution */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Problem</p>
          <p className="text-sm text-text-secondary">{proposal.problem}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Solution</p>
          <p className="text-sm text-text-secondary">{proposal.solution}</p>
        </div>

        {/* RICE Scores */}
        <div className="bg-bg-surface-2 rounded-lg p-4">
          <RICEScoreDisplay
            reach={proposal.reachScore}
            impact={proposal.impactScore}
            confidence={proposal.confidenceScore}
            effort={proposal.effortScore}
            riceScore={proposal.riceScore}
          />
        </div>

        {/* Evidence */}
        {proposal.evidence && proposal.evidence.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
              Evidence ({proposal.evidence.length})
            </p>
            <div className="space-y-2">
              {proposal.evidence.map((ev) => (
                <div key={ev.id} className="bg-bg-surface-2 rounded-lg p-3">
                  {ev.quote && (
                    <p className="text-sm text-text-primary italic mb-1">
                      &ldquo;{ev.quote}&rdquo;
                    </p>
                  )}
                  <p className="text-xs text-text-secondary line-clamp-2">
                    {ev.feedbackItem.content}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-text-muted">
                    {ev.feedbackItem.author && <span>{ev.feedbackItem.author}</span>}
                    {ev.feedbackItem.channel && <span>{ev.feedbackItem.channel}</span>}
                    {ev.feedbackItem.sentiment !== null && (
                      <span className={getSentimentColor(ev.feedbackItem.sentiment)}>
                        S: {ev.feedbackItem.sentiment.toFixed(1)}
                      </span>
                    )}
                    {ev.feedbackItem.urgency !== null && (
                      <span className={getUrgencyColor(ev.feedbackItem.urgency)}>
                        U: {ev.feedbackItem.urgency.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="pt-4 border-t border-border">
          <Button
            variant="danger"
            size="sm"
            loading={deleteMutation.isPending}
            onClick={() => {
              if (confirm('Delete this proposal and all its evidence?')) {
                deleteMutation.mutate(proposal.id, { onSuccess: onClose });
              }
            }}
          >
            Delete Proposal
          </Button>
        </div>
      </div>
    </div>
  );
}
