import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceiptThumbnail } from '@/components/compta/ReceiptPreview';
import { formatCurrency } from '@/lib/utils';
import type { ValidationStatus, WhatsAppDocument } from '@/types/compta';

const STATUS_META: Record<ValidationStatus, { label: string; variant: 'warning' | 'success' | 'destructive' }> = {
  en_attente: { label: 'En attente', variant: 'warning' },
  valide: { label: 'Validé', variant: 'success' },
  rejete: { label: 'Rejeté', variant: 'destructive' },
};

export function WhatsAppReceiptsTable({ documents, onSelect }: { documents: WhatsAppDocument[]; onSelect: (doc: WhatsAppDocument) => void }) {
  if (documents.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Aucun reçu WhatsApp reçu pour le moment.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aperçu</TableHead>
            <TableHead>Date &amp; heure</TableHead>
            <TableHead>Profil WhatsApp</TableHead>
            <TableHead>Fournisseur</TableHead>
            <TableHead className="text-right">Montant TTC</TableHead>
            <TableHead>Compte suggéré</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => {
            const status = STATUS_META[doc.validationStatus];
            return (
              <TableRow key={doc.id} className="cursor-pointer" onClick={() => onSelect(doc)}>
                <TableCell>
                  <ReceiptThumbnail doc={doc} onClick={() => onSelect(doc)} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Date(doc.receivedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium">{doc.senderName}</div>
                  <div className="text-xs text-muted-foreground">{doc.senderPhone}</div>
                </TableCell>
                <TableCell className="text-sm">{doc.fournisseur}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(doc.montantTTC)}</TableCell>
                <TableCell>
                  <span className="font-mono text-xs">{doc.suggestedAccount.compte}</span>
                  <span className="ml-1.5 hidden text-xs text-muted-foreground lg:inline">{doc.suggestedAccount.libelle}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
