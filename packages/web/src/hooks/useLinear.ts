import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { linearApi } from '@/lib/api';

export function useLinearTestConnection() {
  return useMutation({
    mutationFn: () => linearApi.testConnection(),
  });
}

export function useLinearSaveConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, string>) => linearApi.saveConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useLinearTeams() {
  return useQuery({
    queryKey: ['linear', 'teams'],
    queryFn: () => linearApi.listTeams(),
    enabled: false,
    retry: false,
  });
}

export function useLinearProjects() {
  return useQuery({
    queryKey: ['linear', 'projects'],
    queryFn: () => linearApi.listProjects(),
    enabled: false,
    retry: false,
  });
}

export function useLinearLabels() {
  return useQuery({
    queryKey: ['linear', 'labels'],
    queryFn: () => linearApi.listLabels(),
    enabled: false,
    retry: false,
  });
}

export function useLinearStates() {
  return useQuery({
    queryKey: ['linear', 'states'],
    queryFn: () => linearApi.listStates(),
    enabled: false,
    retry: false,
  });
}

export function useLinearCycles() {
  return useQuery({
    queryKey: ['linear', 'cycles'],
    queryFn: () => linearApi.listCycles(),
    enabled: false,
    retry: false,
  });
}

export function useLinearExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => linearApi.exportProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linear'] });
    },
  });
}

export function useLinearExportTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) => linearApi.exportTheme(themeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linear'] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

export function useLinearAttachSpec() {
  return useMutation({
    mutationFn: (proposalId: string) => linearApi.attachSpec(proposalId),
  });
}

export function useLinearImportFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { projectId?: string; stateType?: string; maxResults?: number }) =>
      linearApi.importFeedback(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useLinearSyncStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => linearApi.syncStatus(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linear'] });
    },
  });
}

export function useLinearSyncAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => linearApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linear'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useLinearIssues() {
  return useQuery({
    queryKey: ['linear', 'issues'],
    queryFn: () => linearApi.listIssues(),
    staleTime: 60_000,
  });
}

export function useLinearIssueByProposal(proposalId: string) {
  return useQuery({
    queryKey: ['linear', 'issue', proposalId],
    queryFn: () => linearApi.getByProposal(proposalId),
    staleTime: 60_000,
  });
}

export function useLinearUnlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => linearApi.unlink(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linear'] });
    },
  });
}

export function useLinearDashboard() {
  return useQuery({
    queryKey: ['linear', 'dashboard'],
    queryFn: () => linearApi.dashboardSummary(),
    staleTime: 60_000,
  });
}

export function useLinearCreateAttachment() {
  return useMutation({
    mutationFn: (proposalId: string) => linearApi.createAttachment(proposalId),
  });
}

export function useLinearRegisterWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (callbackUrl: string) => linearApi.registerWebhook(callbackUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useLinearUnregisterWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => linearApi.unregisterWebhook(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
