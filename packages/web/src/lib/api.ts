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

// ============================================
// Themes & Synthesis API
// ============================================

export interface ThemeItem {
  id: string;
  name: string;
  description: string;
  category: string | null;
  painPoints: string[];
  feedbackCount: number;
  avgSentiment: number;
  avgUrgency: number;
  opportunityScore: number;
  jiraEpicKey: string | null;
  jiraEpicUrl: string | null;
  createdAt: string;
  updatedAt: string;
  feedbackItems: {
    feedbackItem: {
      id: string;
      content: string;
      author: string | null;
      sentiment: number | null;
      urgency: number | null;
    };
    similarityScore: number;
  }[];
}

export interface ThemesQueryParams {
  page?: number;
  pageSize?: number;
  category?: string;
  sortBy?: 'opportunityScore' | 'feedbackCount' | 'avgSentiment' | 'avgUrgency' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
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

export const synthesisApi = {
  run: () => api.post<{ data: { jobId: string } }>('/synthesis/run').then((r) => r.data.data),

  status: () => api.get<{ data: SynthesisStatus }>('/synthesis/status').then((r) => r.data.data),

  themes: (params: ThemesQueryParams) =>
    api.get<PaginatedResponse<ThemeItem>>('/synthesis/themes', { params }).then((r) => r.data),

  theme: (id: string) =>
    api.get<{ data: ThemeItem }>(`/synthesis/themes/${id}`).then((r) => r.data.data),
};

// ============================================
// Proposals API
// ============================================

export interface ProposalItem {
  id: string;
  title: string;
  problem: string;
  solution: string;
  status: 'proposed' | 'approved' | 'rejected' | 'shipped';
  reachScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
  riceScore: number | null;
  themeId: string | null;
  theme: { id: string; name: string; category: string | null } | null;
  evidenceCount: number;
  evidence?: {
    id: string;
    quote: string | null;
    relevanceScore: number;
    feedbackItem: {
      id: string;
      content: string;
      author: string | null;
      channel: string | null;
      sentiment: number | null;
      urgency: number | null;
    };
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface ProposalsQueryParams {
  page?: number;
  pageSize?: number;
  status?: string;
  themeId?: string;
  sortBy?: 'riceScore' | 'createdAt' | 'updatedAt' | 'impactScore' | 'effortScore';
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface ProposalGenerationResult {
  proposalsCreated: number;
  proposalsSkipped: number;
  errors: { themeId: string; themeName: string; error: string }[];
}

export const proposalsApi = {
  generate: (topN = 20) =>
    api
      .post<{ data: ProposalGenerationResult }>('/proposals/generate', { topN })
      .then((r) => r.data.data),

  list: (params: ProposalsQueryParams) =>
    api.get<PaginatedResponse<ProposalItem>>('/proposals', { params }).then((r) => r.data),

  get: (id: string) => api.get<{ data: ProposalItem }>(`/proposals/${id}`).then((r) => r.data.data),

  update: (id: string, data: Record<string, unknown>) =>
    api.patch<{ data: ProposalItem }>(`/proposals/${id}`, data).then((r) => r.data.data),

  delete: (id: string) => api.delete(`/proposals/${id}`),
};

// ============================================
// Specs API
// ============================================

export interface SpecItem {
  id: string;
  proposalId: string;
  prdMarkdown: string | null;
  agentPrompt: string | null;
  version: number;
  proposal: {
    id: string;
    title: string;
    status: string;
    riceScore: number | null;
    problem?: string;
    solution?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SpecGenerationResult {
  spec: SpecItem;
  isRegeneration: boolean;
  previousVersion: number | null;
}

export const specsApi = {
  generate: (proposalId: string) =>
    api
      .post<{ data: SpecGenerationResult }>(`/specs/generate/${proposalId}`)
      .then((r) => r.data.data),

  list: () => api.get<{ data: SpecItem[] }>('/specs').then((r) => r.data.data),

  get: (id: string) => api.get<{ data: SpecItem }>(`/specs/${id}`).then((r) => r.data.data),

  getByProposal: (proposalId: string) =>
    api.get<{ data: SpecItem }>(`/specs/by-proposal/${proposalId}`).then((r) => r.data.data),

  getAgentPrompt: (specId: string, format: 'cursor' | 'claude_code' = 'cursor') =>
    api
      .get<{ data: string }>(`/specs/${specId}/agent-prompt`, { params: { format } })
      .then((r) => r.data.data),
};

// ============================================
// Dashboard API
// ============================================

export interface EntityStat {
  total: number;
  currentWeek: number;
  previousWeek: number;
  trendPercent: number;
  trendDirection: 'up' | 'down' | 'flat';
}

export interface DashboardStats {
  feedback: EntityStat;
  themes: EntityStat;
  proposals: EntityStat;
  specs: EntityStat;
}

export interface ActivityEntry {
  id: string;
  type: string;
  description: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface TopTheme {
  id: string;
  name: string;
  feedbackCount: number;
  category: string | null;
}

export interface SentimentDistribution {
  average: number;
  negative: number;
  neutral: number;
  positive: number;
  total: number;
}

export const dashboardApi = {
  stats: () => api.get<{ data: DashboardStats }>('/dashboard/stats').then((r) => r.data.data),

  activity: (limit = 10) =>
    api
      .get<{ data: ActivityEntry[] }>('/dashboard/activity', { params: { limit } })
      .then((r) => r.data.data),

  topThemes: (limit = 5) =>
    api
      .get<{ data: TopTheme[] }>('/dashboard/top-themes', { params: { limit } })
      .then((r) => r.data.data),

  sentiment: () =>
    api.get<{ data: SentimentDistribution }>('/dashboard/sentiment').then((r) => r.data.data),
};

// ============================================
// Settings API
// ============================================

export interface AITestResult {
  success: boolean;
  model: string;
  message: string;
}

export const settingsApi = {
  getAll: () => api.get<{ data: Record<string, string> }>('/settings').then((r) => r.data.data),

  update: (settings: Record<string, string>) =>
    api.put<{ data: Record<string, string> }>('/settings', settings).then((r) => r.data.data),

  testAI: () => api.post<{ data: AITestResult }>('/settings/test-ai').then((r) => r.data.data),

  exportData: () => api.post<{ data: unknown }>('/settings/export').then((r) => r.data.data),

  deleteAllData: () =>
    api
      .delete<{ data: { deleted: Record<string, number> } }>('/settings/data')
      .then((r) => r.data.data),

  // API Keys
  listApiKeys: () =>
    api
      .get<{
        keys: {
          id: string;
          name: string;
          keyPrefix: string;
          createdAt: string;
          isActive: boolean;
        }[];
      }>('/settings/api-keys')
      .then((r) => r.data.keys),

  createApiKey: (name?: string) =>
    api
      .post<{
        key: string;
        id: string;
        name: string;
        keyPrefix: string;
      }>('/settings/api-keys', { name })
      .then((r) => r.data),

  revokeApiKey: (id: string) => api.delete(`/settings/api-keys/${id}`),
};

// ============================================
// Jira Integration API
// ============================================

export interface JiraTestResult {
  success: boolean;
  message: string;
  serverTitle?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface JiraExportResult {
  id: string;
  jiraKey: string;
  jiraUrl: string;
}

export interface JiraThemeExportResult {
  epicKey: string;
  epicUrl: string;
  storiesCreated: number;
  storiesSkipped: number;
}

export interface JiraImportResult {
  imported: number;
  skipped: number;
  sourceId: string;
}

export interface JiraSyncAllResult {
  synced: number;
  autoShipped: number;
  errors: number;
}

export interface JiraDashboardSummary {
  totalExported: number;
  byStatus: Record<string, number>;
  recentExports: {
    jiraKey: string;
    summary: string;
    status: string;
    jiraUrl: string;
    createdAt: string;
  }[];
  epicCount: number;
}

export interface JiraIssueItem {
  id: string;
  proposalId: string;
  jiraKey: string;
  jiraId: string;
  jiraUrl: string;
  issueType: string;
  status: string;
  summary: string;
  syncedAt: string;
  createdAt: string;
  proposal: {
    id: string;
    title: string;
    status: string;
    riceScore: number | null;
  };
}

export const jiraApi = {
  // Configuration
  saveConfig: (config: Record<string, string>) =>
    api.put<{ data: { saved: boolean } }>('/jira/config', config).then((r) => r.data.data),

  testConnection: () => api.post<{ data: JiraTestResult }>('/jira/test').then((r) => r.data.data),

  listProjects: () => api.get<{ data: JiraProject[] }>('/jira/projects').then((r) => r.data.data),

  listIssueTypes: () =>
    api.get<{ data: JiraIssueType[] }>('/jira/issue-types').then((r) => r.data.data),

  // Export & Sync
  exportProposal: (proposalId: string) =>
    api.post<{ data: JiraExportResult }>(`/jira/export/${proposalId}`).then((r) => r.data.data),

  syncStatus: (proposalId: string) =>
    api
      .post<{ data: { jiraKey: string; status: string } }>(`/jira/sync/${proposalId}`)
      .then((r) => r.data.data),

  listIssues: () => api.get<{ data: JiraIssueItem[] }>('/jira/issues').then((r) => r.data.data),

  getByProposal: (proposalId: string) =>
    api.get<{ data: JiraIssueItem | null }>(`/jira/issues/${proposalId}`).then((r) => r.data.data),

  unlink: (proposalId: string) => api.delete(`/jira/issues/${proposalId}`),

  // Theme → Epic bulk export
  exportTheme: (themeId: string) =>
    api
      .post<{ data: JiraThemeExportResult }>(`/jira/export-theme/${themeId}`)
      .then((r) => r.data.data),

  // Spec attachment
  attachSpec: (proposalId: string) =>
    api
      .post<{ data: { jiraKey: string; commented: boolean } }>(`/jira/attach-spec/${proposalId}`)
      .then((r) => r.data.data),

  // Import from Jira
  importFeedback: (options?: { jql?: string; maxResults?: number }) =>
    api
      .post<{ data: JiraImportResult }>('/jira/import-feedback', options || {})
      .then((r) => r.data.data),

  // Bulk sync
  syncAll: () => api.post<{ data: JiraSyncAllResult }>('/jira/sync-all').then((r) => r.data.data),

  // Dashboard
  dashboardSummary: () =>
    api.get<{ data: JiraDashboardSummary }>('/jira/dashboard').then((r) => r.data.data),
};
