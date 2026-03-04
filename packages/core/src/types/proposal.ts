import { type Theme } from './theme';

export type ProposalStatus = 'proposed' | 'approved' | 'rejected' | 'shipped';

export interface RICEScore {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  total: number;
}

export interface Proposal {
  id: string;
  title: string;
  problem: string;
  solution: string;
  status: ProposalStatus;
  scores: RICEScore;
  themeId: string;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalEvidence {
  id: string;
  proposalId: string;
  feedbackItemId: string;
  quote: string;
  relevanceScore: number;
}

export interface ProposalWithEvidence extends Proposal {
  theme: Theme;
  evidence: ProposalEvidence[];
}

export interface UpdateProposalInput {
  title?: string;
  problem?: string;
  solution?: string;
  status?: ProposalStatus;
  scores?: Partial<Omit<RICEScore, 'total'>>;
}
