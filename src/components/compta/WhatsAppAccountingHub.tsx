import { useNavigate } from 'react-router-dom';
import { CheckCircle2, MessageCircle, Receipt, ScanLine, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { mockExpenseApprovals, mockWhatsAppDocuments } from '@/mocks/compta';
import type { OcrStatus } from '@/types/compta';

const OCR_STATUS_LABEL: Record<OcrStatus, string> = {
  en_cours: 'OCR en cours',
  termine: 'OCR terminé',
  echec: 'OCR échoué',
};

function timeAgo(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} j`;
}

export function WhatsAppAccountingHub() {
  const navigate = useNavigate();
  const pending = mockWhatsAppDocuments.filter((d) => d.validationStatus === 'en_attente');

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">WhatsApp Accounting Hub</CardTitle>
            <CardDescription>Saisie et validation des factures/tickets sans friction</CardDescription>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="accent">{pending.length} à valider</Badge>
          <Button size="sm" variant="outline" onClick={() => navigate('/compta/whatsapp')}>
            Ouvrir le module
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-3">
          {mockWhatsAppDocuments.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 rounded-md border p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{doc.fournisseur}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(doc.receivedAt)}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{doc.senderName}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <ScanLine className="h-3 w-3" /> {OCR_STATUS_LABEL[doc.ocrStatus]}
                  </span>
                  {doc.ocrStatus === 'termine' && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{doc.suggestedAccount.compte}</span>
                      <span className="hidden sm:inline">{doc.suggestedAccount.libelle}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold">{formatCurrency(doc.montantTTC)}</div>
                <div className="text-[11px] text-muted-foreground">TVA {formatCurrency(doc.tva)}</div>
              </div>
              {doc.validationStatus === 'valide' ? (
                <Badge variant="success" className="shrink-0">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Validé
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="shrink-0"
                  disabled={doc.ocrStatus !== 'termine'}
                  onClick={() => navigate('/compta/whatsapp')}
                >
                  Valider
                </Button>
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            Demandes d'approbation envoyées aux managers
          </div>
          <div className="space-y-2">
            {mockExpenseApprovals.map((req) => (
              <div key={req.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{req.demandeur}</span>
                  <span className="text-muted-foreground"> → {req.manager} · {req.motif}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{formatCurrency(req.montant)}</span>
                  <Badge variant={req.statut === 'approuve' ? 'success' : req.statut === 'refuse' ? 'destructive' : 'warning'}>
                    {req.statut === 'approuve' ? 'Approuvé' : req.statut === 'refuse' ? 'Refusé' : 'En attente'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
