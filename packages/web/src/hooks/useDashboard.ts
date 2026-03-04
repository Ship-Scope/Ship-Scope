import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/api';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.stats(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useActivityFeed(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => dashboardApi.activity(limit),
    staleTime: 15_000,
  });
}

export function useTopThemes(limit = 5) {
  return useQuery({
    queryKey: ['dashboard', 'top-themes', limit],
    queryFn: () => dashboardApi.topThemes(limit),
    staleTime: 60_000,
  });
}

export function useSentimentDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'sentiment'],
    queryFn: () => dashboardApi.sentiment(),
    staleTime: 60_000,
  });
}
