import { useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReconcileTreasuryTransactionMutation } from '@/hooks/useTreasury';
import { TreasuryTransaction } from '@/types/treasury';

// Comptes SYSCOHADA usuels pour un rapprochement manuel — la liste reste
// courte et déjà pré-triée dans le picker plutôt que de demander à
// l'utilisateur de taper un numéro de compte à la main.
const MATCH_ACCOUNTS: { compte: string; libelle: string }[] = [
  { compte: '411', libelle: 'Clients' },
  { compte: '401', libelle: 'Fournisseurs' },
  { compte: '421', libelle: 'Personnel — rémunérations dues' },
  { compte: '445', libelle: 'État — TVA' },
  { compte: '4711', libelle: "Compte d'attente" },
];

export function ReconcileTransactionDialog({ transaction }: { transaction: TreasuryTransaction }) {
  const [open, setOpen] = useState(false);
  const [compte, setCompte] = useState(MATCH_ACCOUNTS[0].compte);
  const mutation = useReconcileTreasuryTransactionMutation();

  const handleMatch = () => {
    const account = MATCH_ACCOUNTS.find((a) => a.compte === compte)!;
    mutation.mutate(
      { id: transaction.id, action: { statut: 'rapproche', compte: account.compte, libelleCompte: account.libelle } },
      {
        onSuccess: () => {
          toast.success('Transaction rapprochée');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
      }
    );
  };

  const handleAnomaly = () => {
    mutation.mutate(
      { id: transaction.id, action: { statut: 'anomalie' } },
      {
        onSuccess: () => {
          toast.success('Marqué comme anomalie');
          setOpen(false);
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
      }
    );
  };

  if (transaction.statut !== 'en_attente') {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={mutation.isPending}
        onClick={() =>
          mutation.mutate(
            { id: transaction.id, action: { statut: 'en_attente' } },
            { onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur') }
          )
        }
      >
        <Undo2 className="mr-1.5 h-3.5 w-3.5" /> Annuler
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Rapprocher</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rapprocher — {transaction.libelle}</DialogTitle>
          <DialogDescription>Associe ce mouvement à un compte SYSCOHADA, ou marque-le comme anomalie.</DialogDescription>
        </DialogHeader>

        <Select value={compte} onValueChange={setCompte}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATCH_ACCOUNTS.map((a) => (
              <SelectItem key={a.compte} value={a.compte}>
                {a.compte} — {a.libelle}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleAnomaly} disabled={mutation.isPending}>
            <AlertTriangle className="mr-1.5 h-3.5 w-3.5" /> Marquer anomalie
          </Button>
          <Button type="button" onClick={handleMatch} disabled={mutation.isPending}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Rapprocher
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
