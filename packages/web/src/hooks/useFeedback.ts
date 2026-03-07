import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { feedbackApi, type FeedbackQueryParams } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

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
  const { toast } = useToast();
  return useMutation({
    mutationFn: feedbackApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback created');
    },
    onError: () => {
      toast.error('Creation failed', 'Could not create feedback item.');
    },
  });
}

export function useDeleteFeedback() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: string) => feedbackApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback deleted');
    },
    onError: () => {
      toast.error('Delete failed', 'Could not delete the feedback item.');
    },
  });
}

export function useBulkDeleteFeedback() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (ids: string[]) => feedbackApi.bulkDelete(ids),
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} deleted`);
    },
    onError: () => {
      toast.error('Bulk delete failed', 'Could not delete the selected items.');
    },
  });
}

export function useMarkProcessed() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (ids: string[]) => feedbackApi.markProcessed(ids),
    onSuccess: (_data, ids) => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success(`${ids.length} item${ids.length > 1 ? 's' : ''} marked as processed`);
    },
    onError: () => {
      toast.error('Update failed', 'Could not mark items as processed.');
    },
  });
}
