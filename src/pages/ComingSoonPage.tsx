import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface ComingSoonPageProps {
  titleKey?: string;
}

export function ComingSoonPage({ titleKey }: ComingSoonPageProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <Construction className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{titleKey ? t(titleKey) : t('app.name')}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ce module fait partie d'un lot de développement ultérieur et sera disponible prochainement.
        </p>
      </CardContent>
    </Card>
  );
}
