import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specsApi } from '@/lib/api';

export function useSpecsList() {
  return useQuery({
    queryKey: ['specs', 'list'],
    queryFn: () => specsApi.list(),
  });
}

export function useSpecDetail(id: string | null) {
  return useQuery({
    queryKey: ['specs', 'detail', id],
    queryFn: () => specsApi.get(id!),
    enabled: !!id,
  });
}

export function useSpecByProposal(proposalId: string | null) {
  return useQuery({
    queryKey: ['specs', 'by-proposal', proposalId],
    queryFn: () => specsApi.getByProposal(proposalId!),
    enabled: !!proposalId,
    retry: false,
  });
}

export function useAgentPrompt(specId: string | null, format: 'cursor' | 'claude_code') {
  return useQuery({
    queryKey: ['specs', specId, 'agent-prompt', format],
    queryFn: () => specsApi.getAgentPrompt(specId!, format),
    enabled: !!specId,
  });
}

export function useGenerateSpec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => specsApi.generate(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['specs'] });
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}
