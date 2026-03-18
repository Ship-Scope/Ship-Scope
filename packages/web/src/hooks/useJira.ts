import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jiraApi } from '@/lib/api';

export function useJiraTestConnection() {
  return useMutation({
    mutationFn: () => jiraApi.testConnection(),
  });
}

export function useJiraSaveConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, string>) => jiraApi.saveConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useJiraProjects() {
  return useQuery({
    queryKey: ['jira', 'projects'],
    queryFn: () => jiraApi.listProjects(),
    enabled: false,
    retry: false,
  });
}

export function useJiraIssueTypes() {
  return useQuery({
    queryKey: ['jira', 'issue-types'],
    queryFn: () => jiraApi.listIssueTypes(),
    enabled: false,
    retry: false,
  });
}

export function useJiraPriorities() {
  return useQuery({
    queryKey: ['jira', 'priorities'],
    queryFn: () => jiraApi.listPriorities(),
    enabled: false,
    retry: false,
  });
}

export function useJiraFields() {
  return useQuery({
    queryKey: ['jira', 'fields'],
    queryFn: () => jiraApi.listFields(),
    enabled: false,
    retry: false,
  });
}

export function useJiraExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => jiraApi.exportProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
    },
  });
}

export function useJiraExportTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) => jiraApi.exportTheme(themeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

export function useJiraAttachSpec() {
  return useMutation({
    mutationFn: (proposalId: string) => jiraApi.attachSpec(proposalId),
  });
}

export function useJiraImportFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { jql?: string; maxResults?: number }) =>
      jiraApi.importFeedback(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useJiraSyncStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => jiraApi.syncStatus(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
    },
  });
}

export function useJiraSyncAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => jiraApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useJiraIssues() {
  return useQuery({
    queryKey: ['jira', 'issues'],
    queryFn: () => jiraApi.listIssues(),
    staleTime: 60_000,
  });
}

export function useJiraIssueByProposal(proposalId: string) {
  return useQuery({
    queryKey: ['jira', 'issue', proposalId],
    queryFn: () => jiraApi.getByProposal(proposalId),
    staleTime: 60_000,
  });
}

export function useJiraUnlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => jiraApi.unlink(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jira'] });
    },
  });
}

export function useJiraDashboard() {
  return useQuery({
    queryKey: ['jira', 'dashboard'],
    queryFn: () => jiraApi.dashboardSummary(),
    staleTime: 60_000,
  });
}
