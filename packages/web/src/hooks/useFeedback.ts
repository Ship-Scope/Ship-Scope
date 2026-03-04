import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { feedbackApi, type FeedbackQueryParams } from '@/lib/api';

export function useFeedbackList(params: FeedbackQueryParams) {
  return useQuery({
    queryKey: ['feedback', 'list', params],
    queryFn: () => feedbackApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useFeedbackStats() {
  return useQuery({
    queryKey: ['feedback', 'stats'],
    queryFn: () => feedbackApi.stats(),
    staleTime: 60_000,
  });
}

export function useFeedbackDetail(id: string | null) {
  return useQuery({
    queryKey: ['feedback', 'detail', id],
    queryFn: () => feedbackApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => feedbackApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useBulkDeleteFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => feedbackApi.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}

export function useMarkProcessed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => feedbackApi.markProcessed(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
    },
  });
}
