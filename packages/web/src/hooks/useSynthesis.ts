import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { synthesisApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export function useSynthesisStatus() {
  return useQuery({
    queryKey: ['synthesis', 'status'],
    queryFn: () => synthesisApi.status(),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Poll every 2s while active, stop when idle/complete/failed
      if (status && !['idle', 'completed', 'failed'].includes(status)) {
        return 2000;
      }
      return false;
    },
  });
}

export function useRunSynthesis() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => synthesisApi.run(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['synthesis', 'status'] });
      toast.success('Synthesis started', 'Processing feedback into themes...');
    },
    onError: () => {
      toast.error('Synthesis failed', 'Could not start the synthesis pipeline.');
    },
  });
}
