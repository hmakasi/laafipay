import { toast } from 'sonner';
import { ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useSetPaymentValidationMutation } from '@/hooks/useComptaBridge';
import { formatDate } from '@/lib/utils';
import type { ComptaBridgeJournalEntry } from '@/types/comptaBridge';

// Contrôle interne LaafiCompta : `payments:validate` (accountant/admin)
// autorise le paiement des salaires correspondant à une OD déjà reçue —
// distinct de `payments:initiate` (RH), qui prépare le cycle côté
// LaafiPay. Partagé entre le widget du dashboard et l'onglet Passerelle
// Paie pour ne pas dupliquer la logique de mutation/permission.
export function PaymentValidationPanel({ journalEntry }: { journalEntry: ComptaBridgeJournalEntry }) {
  const mutation = useSetPaymentValidationMutation();

  const handleToggle = (validated: boolean) => {
    mutation.mutate(
      { journalEntryId: journalEntry.id, validated },
      {
        onSuccess: () => toast.success(validated ? 'Paiement validé par la comptabilité' : 'Validation du paiement annulée'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la validation'),
      }
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm">
        <ShieldCheck className={journalEntry.paymentValidated ? 'h-4 w-4 text-green-600' : 'h-4 w-4 text-muted-foreground'} />
        {journalEntry.paymentValidated ? (
          <span>
            Paiement validé par <span className="font-medium">{journalEntry.paymentValidatedBy}</span>
            {journalEntry.paymentValidatedAt && ` le ${formatDate(journalEntry.paymentValidatedAt.slice(0, 10))}`}
          </span>
        ) : (
          <span className="text-muted-foreground">Paiement pas encore autorisé par la comptabilité</span>
        )}
      </div>
      <PermissionGate permission="payments:validate">
        {journalEntry.paymentValidated ? (
          <Button size="sm" variant="outline" disabled={mutation.isPending} onClick={() => handleToggle(false)}>
            <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Annuler la validation
          </Button>
        ) : (
          <Button size="sm" disabled={mutation.isPending} onClick={() => handleToggle(true)}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Valider le paiement
          </Button>
        )}
      </PermissionGate>
    </div>
  );
}
