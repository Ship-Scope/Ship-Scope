import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importApi } from '@/lib/api';
import { useToast } from '@/context/ToastContext';

export function useImportPreview() {
  return useMutation({
    mutationFn: (file: File) => importApi.preview(file),
  });
}

export function useImportCSV() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ file, mapping }: { file: File; mapping?: Record<string, string> }) =>
      importApi.importCSV(file, mapping),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('CSV imported', 'Feedback items have been added.');
    },
    onError: () => {
      toast.error('Import failed', 'Could not import the CSV file.');
    },
  });
}

export function useImportJSON() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (file: File) => importApi.importJSON(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('JSON imported', 'Feedback items have been added.');
    },
    onError: () => {
      toast.error('Import failed', 'Could not import the JSON file.');
    },
  });
}

export function useImportJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['import-job', jobId],
    queryFn: () => importApi.jobStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') return false;
      return 2000;
    },
  });
}
