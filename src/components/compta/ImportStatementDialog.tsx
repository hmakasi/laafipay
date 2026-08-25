import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useImportTreasuryStatementMutation } from '@/hooks/useTreasury';
import { ImportRow } from '@/types/treasury';

// Aucune API bancaire/Mobile Money réelle disponible : l'import se fait
// par relevé CSV fourni par l'utilisateur. Format attendu, une ligne par
// mouvement : date;libellé;montant — montant signé (positif = encaissement,
// négatif = décaissement), convention courante de relevé bancaire. Une
// éventuelle ligne d'en-tête (date non reconnue en première position) est
// ignorée automatiquement.
function parseStatementCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows: ImportRow[] = [];

  for (const line of lines) {
    const delimiter = line.includes(';') ? ';' : ',';
    const parts = line.split(delimiter).map((p) => p.trim());
    if (parts.length < 3) continue;

    const [date, libelle, montantRaw] = parts;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue; // ligne d'en-tête ou invalide, ignorée
    const montant = Number(montantRaw.replace(',', '.'));
    if (Number.isNaN(montant)) continue;

    rows.push({ date, libelle, montant });
  }

  return rows;
}

export function ImportStatementDialog({ accountId, accountLabel }: { accountId: string; accountLabel: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutation = useImportTreasuryStatementMutation();

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseStatementCsv(text);
    setRows(parsed);
    setFileName(file.name);
    if (parsed.length === 0) {
      toast.error("Aucune ligne valide trouvée — vérifie le format (date;libellé;montant, date en AAAA-MM-JJ)");
    }
  };

  const handleImport = async () => {
    try {
      const result = await mutation.mutateAsync({ accountId, rows });
      toast.success(`${result.imported} mouvement(s) importé(s), ${result.autoMatched} rapproché(s) automatiquement`);
      setOpen(false);
      setRows([]);
      setFileName(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'import");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-1.5 h-3.5 w-3.5" /> Importer un relevé
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer un relevé — {accountLabel}</DialogTitle>
          <DialogDescription>
            Fichier CSV, une ligne par mouvement : <code className="font-mono text-xs">date;libellé;montant</code> (date au
            format AAAA-MM-JJ, montant négatif pour un décaissement).
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          {fileName ?? 'Choisir un fichier CSV'}
        </Button>

        {rows.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 text-left font-medium">Date</th>
                  <th className="px-3 py-1.5 text-left font-medium">Libellé</th>
                  <th className="px-3 py-1.5 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5 text-xs">{r.date}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.libelle}</td>
                    <td className="px-3 py-1.5 text-right text-xs">{r.montant}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 && (
              <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">… et {rows.length - 50} autre(s) ligne(s)</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImport} disabled={rows.length === 0 || mutation.isPending}>
            Importer {rows.length > 0 ? `${rows.length} mouvement(s)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
