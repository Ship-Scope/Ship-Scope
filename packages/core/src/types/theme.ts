import { type FeedbackItem } from './feedback';

export type ThemeCategory =
  | 'bug'
  | 'feature_request'
  | 'ux_issue'
  | 'performance'
  | 'documentation'
  | 'pricing'
  | 'other';

export interface Theme {
  id: string;
  name: string;
  description: string;
  category: ThemeCategory;
  painPoints: string[];
  feedbackCount: number;
  avgSentiment: number;
  avgUrgency: number;
  opportunityScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeWithFeedback extends Theme {
  feedbackItems: FeedbackItem[];
}

export interface ThemeWithEvidence extends Theme {
  sampleFeedback: string[];
}

export interface SynthesisStatus {
  jobId: string;
  status: 'idle' | 'embedding' | 'scoring' | 'clustering' | 'naming' | 'completed' | 'failed';
  progress: number;
  stage: string;
  totalItems: number;
  processedItems: number;
  themesFound: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}
