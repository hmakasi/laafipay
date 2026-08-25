import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getComptaBridgeEvents, setJournalEntryPaymentValidation } from '@/services/api/comptaBridge';

// Tant qu'un événement est "en_attente" (livraison à LaafiCompta pas
// encore confirmée), on repasse dessus toutes les 5s pour refléter le
// job de retry serveur sans que l'utilisateur ait à rafraîchir — dès que
// tout est "envoye"/"echec" (état stable), on arrête de poller.
export function useComptaBridgeEventsQuery() {
  return useQuery({
    queryKey: ['compta-bridge-events'],
    queryFn: getComptaBridgeEvents,
    refetchInterval: (query) => (query.state.data?.some((e) => e.status === 'en_attente') ? 5_000 : false),
  });
}

export function useSetPaymentValidationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ journalEntryId, validated }: { journalEntryId: string; validated: boolean }) =>
      setJournalEntryPaymentValidation(journalEntryId, validated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compta-bridge-events'] });
    },
  });
}
