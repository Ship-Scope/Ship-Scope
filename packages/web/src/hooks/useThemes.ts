import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { synthesisApi, type ThemesQueryParams } from '@/lib/api';

export function useThemesList(params: ThemesQueryParams) {
  return useQuery({
    queryKey: ['themes', 'list', params],
    queryFn: () => synthesisApi.themes(params),
    placeholderData: keepPreviousData,
  });
}

export function useThemeDetail(id: string | null) {
  return useQuery({
    queryKey: ['themes', 'detail', id],
    queryFn: () => synthesisApi.theme(id!),
    enabled: !!id,
  });
}
