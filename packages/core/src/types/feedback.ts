export type FeedbackChannel =
  | 'support_ticket'
  | 'interview'
  | 'survey'
  | 'slack'
  | 'app_review'
  | 'manual'
  | 'other';

export type FeedbackSourceType = 'csv' | 'json' | 'api' | 'webhook' | 'manual';

export interface FeedbackSource {
  id: string;
  name: string;
  type: FeedbackSourceType;
  filename: string | null;
  rowCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FeedbackItem {
  id: string;
  content: string;
  author: string | null;
  email: string | null;
  channel: FeedbackChannel;
  sourceId: string;
  sentiment: number | null;
  urgency: number | null;
  embeddedAt: string | null;
  processedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFeedbackInput {
  content: string;
  author?: string;
  email?: string;
  channel?: FeedbackChannel;
  metadata?: Record<string, unknown>;
}

export interface FeedbackFilters {
  search?: string;
  channel?: FeedbackChannel;
  sourceId?: string;
  processed?: boolean;
  sentimentMin?: number;
  sentimentMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface FeedbackStats {
  total: number;
  processed: number;
  unprocessed: number;
  byChannel: Record<string, number>;
  avgSentiment: number;
  avgUrgency: number;
}

export interface ImportJobStatus {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: string[];
}

export interface CSVColumnMapping {
  content: string;
  author?: string;
  email?: string;
  channel?: string;
  date?: string;
}
