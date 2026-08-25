import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircleWarning, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptZoomPanel } from '@/components/compta/ReceiptPreview';
import { formatCurrency } from '@/lib/utils';
import { SETTLEMENT_LABELS, SUPPLIER_ACCOUNTS, SYSCOHADA_EXPENSE_ACCOUNTS, buildExpenseJournalEntry } from '@/lib/comptaAccounts';
import type { ExpenseJournalEntry, SettlementMethod, SupplierAccount, WhatsAppDocument } from '@/types/compta';

interface WhatsAppValidationModalProps {
  doc: WhatsAppDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (entry: ExpenseJournalEntry, updatedDoc: WhatsAppDocument) => void;
  onSaveDraft: (updatedDoc: WhatsAppDocument) => void;
  onReject: (docId: string) => void;
}

export function WhatsAppValidationModal({ doc, open, onOpenChange, onConfirm, onSaveDraft, onReject }: WhatsAppValidationModalProps) {
  const [form, setForm] = useState<WhatsAppDocument | null>(doc);
  const [savedNotice, setSavedNotice] = useState(false);
  const [generatedEntry, setGeneratedEntry] = useState<ExpenseJournalEntry | null>(null);

  // Se resynchronise uniquement quand l'id change (nouveau reçu ouvert),
  // pas à chaque nouvelle référence de `doc` : après `onSaveDraft` ou
  // `onConfirm`, le parent renvoie un `doc` mis à jour avec le même id,
  // ce qui ne doit pas écraser l'état local du formulaire en cours.
  useEffect(() => {
    setForm(doc);
    setSavedNotice(false);
    setGeneratedEntry(null);
  }, [doc?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!form) return null;

  const montantTTC = form.montantHT + form.tva;

  const updateField = <K extends keyof WhatsAppDocument>(key: K, value: WhatsAppDocument[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedNotice(false);
  };

  const handleConfirm = () => {
    const finalDoc: WhatsAppDocument = { ...form, montantTTC, validationStatus: 'valide' };
    const entry = buildExpenseJournalEntry(finalDoc);
    setForm(finalDoc);
    setGeneratedEntry(entry);
    onConfirm(entry, finalDoc);
  };

  const handleSaveDraft = () => {
    const draft: WhatsAppDocument = { ...form, montantTTC };
    onSaveDraft(draft);
    setSavedNotice(true);
  };

  const handleReject = () => {
    onReject(form.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Validation du reçu — {form.fournisseur}</DialogTitle>
          <DialogDescription>
            Envoyé par {form.senderName} ({form.senderPhone}) le {new Date(form.receivedAt).toLocaleString('fr-FR')}
          </DialogDescription>
        </DialogHeader>

        {generatedEntry ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/20 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Reçu comptabilisé — écriture générée automatiquement dans le journal Achats ({generatedEntry.piece}).
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Compte</th>
                    <th className="px-3 py-2 text-left font-medium">Libellé</th>
                    <th className="px-3 py-2 text-right font-medium">Débit</th>
                    <th className="px-3 py-2 text-right font-medium">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {generatedEntry.lignes.map((line) => (
                    <tr key={line.compte} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{line.compte}</td>
                      <td className="px-3 py-2 text-muted-foreground">{line.libelleCompte}</td>
                      <td className="px-3 py-2 text-right">{line.debit ? formatCurrency(line.debit) : '—'}</td>
                      <td className="px-3 py-2 text-right">{line.credit ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fermer</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="flex flex-col items-center gap-2">
                <Label className="self-start text-xs uppercase text-muted-foreground">Pièce jointe WhatsApp</Label>
                <ReceiptZoomPanel doc={form} />
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="fournisseur">Fournisseur</Label>
                  <Input id="fournisseur" value={form.fournisseur} onChange={(e) => updateField('fournisseur', e.target.value)} />
                </div>

                <div>
                  <Label>Compte fournisseur</Label>
                  <Select value={form.fournisseurCompte} onValueChange={(v) => updateField('fournisseurCompte', v as SupplierAccount)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPLIER_ACCOUNTS.map((a) => (
                        <SelectItem key={a.compte} value={a.compte}>
                          {a.compte} — {a.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Compte de charge SYSCOHADA</Label>
                  <Select
                    value={form.suggestedAccount.compte}
                    onValueChange={(v) => {
                      const account = SYSCOHADA_EXPENSE_ACCOUNTS.find((a) => a.compte === v);
                      if (account) updateField('suggestedAccount', account);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYSCOHADA_EXPENSE_ACCOUNTS.map((a) => (
                        <SelectItem key={a.compte} value={a.compte}>
                          {a.compte} — {a.libelle}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="montantHT">Montant HT</Label>
                    <Input
                      id="montantHT"
                      type="number"
                      value={form.montantHT}
                      onChange={(e) => updateField('montantHT', Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tva">TVA (445)</Label>
                    <Input id="tva" type="number" value={form.tva} onChange={(e) => updateField('tva', Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label htmlFor="ttc">Montant TTC</Label>
                    <Input id="ttc" value={formatCurrency(montantTTC)} disabled className="font-medium" />
                  </div>
                </div>

                <div>
                  <Label>Mode de règlement</Label>
                  <Select value={form.settlementMethod} onValueChange={(v) => updateField('settlementMethod', v as SettlementMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SETTLEMENT_LABELS) as SettlementMethod[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {SETTLEMENT_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="description">Description / motif</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </div>

                {savedNotice && (
                  <Badge variant="accent" className="w-fit">
                    Imputation enregistrée
                  </Badge>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={handleReject}>
                <MessageCircleWarning className="mr-1.5 h-4 w-4" /> Rejeter / Demander précision via WhatsApp
              </Button>
              <Button type="button" variant="secondary" onClick={handleSaveDraft}>
                <PencilLine className="mr-1.5 h-4 w-4" /> Modifier l'imputation
              </Button>
              <Button type="button" onClick={handleConfirm}>
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmer &amp; Comptabiliser
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
