import { useState } from 'react';
import { BookOpen, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { WhatsAppReceiptsTable } from '@/components/compta/WhatsAppReceiptsTable';
import { WhatsAppValidationModal } from '@/components/compta/WhatsAppValidationModal';
import { formatCurrency } from '@/lib/utils';
import { mockWhatsAppDocuments } from '@/mocks/compta';
import type { ExpenseJournalEntry, WhatsAppDocument } from '@/types/compta';

export function WhatsAppAccountingPage() {
  const [documents, setDocuments] = useState<WhatsAppDocument[]>(mockWhatsAppDocuments);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatedEntries, setGeneratedEntries] = useState<ExpenseJournalEntry[]>([]);

  const selectedDoc = documents.find((d) => d.id === selectedId) ?? null;
  const pendingCount = documents.filter((d) => d.validationStatus === 'en_attente').length;

  const updateDocument = (updated: WhatsAppDocument) => {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  };

  const handleConfirm = (entry: ExpenseJournalEntry, updatedDoc: WhatsAppDocument) => {
    updateDocument(updatedDoc);
    setGeneratedEntries((prev) => [entry, ...prev]);
  };

  const handleReject = (docId: string) => {
    setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, validationStatus: 'rejete' } : d)));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp Accounting Hub
          </h1>
          <p className="text-sm text-muted-foreground">
            Factures et tickets reçus par les employés via WhatsApp, extraits par OCR, prêts à valider.
          </p>
        </div>
        {pendingCount > 0 && <Badge variant="warning">{pendingCount} à traiter</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reçus en attente de validation</CardTitle>
          <CardDescription>Cliquez sur une ligne pour ouvrir la fiche de validation.</CardDescription>
        </CardHeader>
        <CardContent>
          <WhatsAppReceiptsTable documents={documents} onSelect={(doc) => setSelectedId(doc.id)} />
        </CardContent>
      </Card>

      {generatedEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4 text-muted-foreground" /> Écritures générées automatiquement
            </CardTitle>
            <CardDescription>Journal Achats — une écriture par reçu comptabilisé, cette session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {generatedEntries.map((entry) => (
              <div key={entry.id} className="overflow-x-auto rounded-md border">
                <div className="border-b bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {entry.piece} · {entry.libelle}
                </div>
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
                    {entry.lignes.map((line) => (
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
            ))}
          </CardContent>
        </Card>
      )}

      <WhatsAppValidationModal
        doc={selectedDoc}
        open={selectedId !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onConfirm={handleConfirm}
        onSaveDraft={updateDocument}
        onReject={handleReject}
      />
    </div>
  );
}
