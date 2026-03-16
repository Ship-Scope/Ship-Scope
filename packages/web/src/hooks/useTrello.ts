import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { trelloApi } from '@/lib/api';

export function useTrelloTestConnection() {
  return useMutation({
    mutationFn: () => trelloApi.testConnection(),
  });
}

export function useTrelloSaveConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: Record<string, string>) => trelloApi.saveConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useTrelloBoards() {
  return useQuery({
    queryKey: ['trello', 'boards'],
    queryFn: () => trelloApi.listBoards(),
    enabled: false,
    retry: false,
  });
}

export function useTrelloLists() {
  return useQuery({
    queryKey: ['trello', 'lists'],
    queryFn: () => trelloApi.listLists(),
    enabled: false,
    retry: false,
  });
}

export function useTrelloExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => trelloApi.exportProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trello'] });
    },
  });
}

export function useTrelloExportTheme() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (themeId: string) => trelloApi.exportTheme(themeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trello'] });
      queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
  });
}

export function useTrelloAttachSpec() {
  return useMutation({
    mutationFn: (proposalId: string) => trelloApi.attachSpec(proposalId),
  });
}

export function useTrelloImportFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (options?: { listId?: string; maxResults?: number }) =>
      trelloApi.importFeedback(options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTrelloSyncStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => trelloApi.syncStatus(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trello'] });
    },
  });
}

export function useTrelloSyncAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trelloApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trello'] });
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useTrelloCards() {
  return useQuery({
    queryKey: ['trello', 'cards'],
    queryFn: () => trelloApi.listCards(),
    staleTime: 60_000,
  });
}

export function useTrelloCardByProposal(proposalId: string) {
  return useQuery({
    queryKey: ['trello', 'card', proposalId],
    queryFn: () => trelloApi.getByProposal(proposalId),
    staleTime: 60_000,
  });
}

export function useTrelloUnlink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => trelloApi.unlink(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trello'] });
    },
  });
}

export function useTrelloDashboard() {
  return useQuery({
    queryKey: ['trello', 'dashboard'],
    queryFn: () => trelloApi.dashboardSummary(),
    staleTime: 60_000,
  });
}

export function useTrelloCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => trelloApi.createBoard(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['trello'] });
    },
  });
}
