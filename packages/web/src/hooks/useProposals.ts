import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { proposalsApi, type ProposalsQueryParams } from '@/lib/api';

export function useProposalsList(params: ProposalsQueryParams) {
  return useQuery({
    queryKey: ['proposals', 'list', params],
    queryFn: () => proposalsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useProposalDetail(id: string | null) {
  return useQuery({
    queryKey: ['proposals', 'detail', id],
    queryFn: () => proposalsApi.get(id!),
    enabled: !!id,
  });
}

export function useGenerateProposals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topN?: number) => proposalsApi.generate(topN),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      proposalsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}
