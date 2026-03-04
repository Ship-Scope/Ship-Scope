import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ============================================
// Feedback API
// ============================================

export interface FeedbackItem {
  id: string;
  content: string;
  author: string | null;
  email: string | null;
  channel: string | null;
  sentiment: number | null;
  urgency: number | null;
  processedAt: string | null;
  createdAt: string;
  source: { name: string; type: string };
  themes: { theme: { name: string }; similarityScore: number }[];
  metadata: Record<string, unknown>;
}

export interface FeedbackQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  channel?: string;
  sourceId?: string;
  processed?: 'true' | 'false';
  sentimentMin?: number;
  sentimentMax?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'createdAt' | 'sentiment' | 'urgency';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface FeedbackStats {
  total: number;
  processed: number;
  unprocessed: number;
  channels: { channel: string | null; _count: number }[];
  avgSentiment: number | null;
  avgUrgency: number | null;
}

export const feedbackApi = {
  list: (params: FeedbackQueryParams) =>
    api.get<PaginatedResponse<FeedbackItem>>('/feedback', { params }).then((r) => r.data),

  get: (id: string) => api.get<{ data: FeedbackItem }>(`/feedback/${id}`).then((r) => r.data.data),

  create: (data: { content: string; author?: string; email?: string; channel?: string }) =>
    api.post<{ data: FeedbackItem }>('/feedback', data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/feedback/${id}`),

  bulkDelete: (ids: string[]) =>
    api
      .post<{ data: { deleted: number } }>('/feedback/bulk-delete', { ids })
      .then((r) => r.data.data),

  markProcessed: (ids: string[]) =>
    api
      .post<{ data: { updated: number } }>('/feedback/mark-processed', { ids })
      .then((r) => r.data.data),

  stats: () => api.get<{ data: FeedbackStats }>('/feedback/stats').then((r) => r.data.data),
};

// ============================================
// Import API
// ============================================

export interface ImportPreviewResponse {
  data: {
    headers: string[];
    preview: Record<string, string>[];
    suggestedMapping: {
      content: string;
      author?: string;
      email?: string;
      channel?: string;
      date?: string;
    };
    totalRows: number;
    confidence: 'high' | 'medium' | 'low';
  };
}

export interface ImportResponse {
  data:
    | { imported: number; skipped: number; errors: number; errorDetails?: string[] }
    | { jobId: string };
}

export interface ImportJobStatus {
  status: 'waiting' | 'active' | 'completed' | 'failed';
  progress: number;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  errors: string[];
  result?: { processed: number; errors: number };
}

export const importApi = {
  preview: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportPreviewResponse>('/feedback/import/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  importCSV: (file: File, columnMapping?: Record<string, string>) => {
    const form = new FormData();
    form.append('file', file);
    if (columnMapping) form.append('mapping', JSON.stringify(columnMapping));
    return api
      .post<ImportResponse>('/feedback/import/csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  importJSON: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post<ImportResponse>('/feedback/import/json', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data.data);
  },

  jobStatus: (jobId: string) =>
    api.get<ImportJobStatus>(`/feedback/import/${jobId}`).then((r) => r.data),
};
