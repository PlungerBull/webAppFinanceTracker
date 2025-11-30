import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupingsApi } from '../api/groupings';
import { QUERY_CONFIG, QUERY_KEYS } from '@/lib/constants';

export function useGroupings() {
  return useQuery({
    queryKey: QUERY_KEYS.GROUPINGS,
    queryFn: groupingsApi.getAll,
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });
}

export function useGroupingChildren(parentId: string) {
  return useQuery({
    queryKey: ['grouping-children', parentId],
    queryFn: () => groupingsApi.getChildren(parentId),
    enabled: !!parentId,
    staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM,
  });
}

export function useAddGrouping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      groupingsApi.createParent(data.name, data.color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useUpdateGrouping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      groupingsApi.updateParent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useDeleteGrouping() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => groupingsApi.deleteParent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useAddSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, parentId, color }: { name: string; parentId: string; color: string }) =>
      groupingsApi.createSubcategory(name, parentId, color),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useReassignSubcategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ childId, newParentId }: { childId: string; newParentId: string }) =>
      groupingsApi.reassignSubcategory(childId, newParentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GROUPINGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}
