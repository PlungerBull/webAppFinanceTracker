import { useMutation, useQueryClient } from '@tanstack/react-query';
import { transfersApi, type CreateTransferData } from '../api/transfers';
import { QUERY_KEYS } from '@/lib/constants';

export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransferData) => transfersApi.createTransfer(data),
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}
