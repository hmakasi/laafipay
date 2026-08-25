import { useState } from 'react';
import { Receipt, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import type { WhatsAppDocument } from '@/types/compta';

// Ni LaafiPay ni LaafiCompta ne stockent encore de vraies pièces jointes
// WhatsApp (OCR/IA côté serveur hors scope de ce lot) : ce composant
// simule le rendu d'un reçu/ticket photographié, dans le même format
// (ticket de caisse) pour les deux tailles d'affichage — miniature dans
// le tableau, grand format zoomable dans la modale de validation.
function ReceiptFace({ doc }: { doc: WhatsAppDocument }) {
  return (
    <div className="w-52 shrink-0 rounded-sm bg-white p-3 font-mono text-[10px] leading-snug text-slate-700 shadow-lg">
      <div className="flex items-center justify-center gap-1 text-center font-semibold uppercase tracking-wide">
        <Receipt className="h-3 w-3" /> {doc.fournisseur}
      </div>
      <div className="mt-1 border-t border-dashed border-slate-300 pt-1 text-center text-slate-400">
        {new Date(doc.receivedAt).toLocaleString('fr-FR')}
      </div>
      <div className="mt-2 space-y-1 border-t border-dashed border-slate-300 pt-2">
        <div className="flex justify-between">
          <span>Montant HT</span>
          <span>{formatCurrency(doc.montantHT)}</span>
        </div>
        <div className="flex justify-between">
          <span>TVA</span>
          <span>{formatCurrency(doc.tva)}</span>
        </div>
        <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 font-semibold">
          <span>TOTAL TTC</span>
          <span>{formatCurrency(doc.montantTTC)}</span>
        </div>
      </div>
      <div className="mt-2 border-t border-dashed border-slate-300 pt-1 text-center text-[8px] text-slate-400">
        Reçu via WhatsApp — {doc.senderPhone}
      </div>
    </div>
  );
}

export function ReceiptThumbnail({ doc, onClick }: { doc: WhatsAppDocument; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Ouvrir l'aperçu"
      className="flex h-14 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-dashed border-slate-300 bg-white px-0.5 text-slate-400 shadow-sm transition-colors hover:border-primary"
    >
      <Receipt className="h-4 w-4" />
      <span className="line-clamp-2 text-center text-[7px] leading-tight text-slate-500">{doc.fournisseur}</span>
    </button>
  );
}

export function ReceiptZoomPanel({ doc }: { doc: WhatsAppDocument }) {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-80 items-center justify-center overflow-auto rounded-lg border bg-slate-100 p-4 dark:bg-slate-900">
        <div className="transition-transform duration-150" style={{ transform: `scale(${zoom})` }}>
          <ReceiptFace doc={doc} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10))}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <span className="w-10 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom((z) => Math.min(2.2, Math.round((z + 0.2) * 10) / 10))}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
