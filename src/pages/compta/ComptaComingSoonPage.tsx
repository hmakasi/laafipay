import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function ComptaComingSoonPage({ title }: { title: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ce module LaafiCompta fait partie d'un lot de développement ultérieur et sera disponible prochainement.
        </p>
      </CardContent>
    </Card>
  );
}
