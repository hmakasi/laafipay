import { useTranslation } from 'react-i18next';
import { Landmark, MessageCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

const WHATSAPP_NUMBER = '221781508698';
const WHATSAPP_MESSAGE = "Bonjour, j'ai une question concernant LaafiPay";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

// Petit label "kicker" au-dessus du titre de chaque carte — même touche
// vert émeraude (text-primary = --primary, #059669) sur les deux cartes.
function CardKicker({ children }: { children: string }) {
  return <div className="text-xs font-semibold uppercase tracking-wide text-primary">{children}</div>;
}

export function AboutContactSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div id="a-propos" className="mx-auto max-w-5xl scroll-mt-16">
          <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
            {t('landing.about.title')}
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Bloc Vision — fond blanc (bg-card), touche émeraude sur le kicker/l'icône */}
            <Card className="bg-card">
              <CardHeader className="space-y-3">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" />
                  <CardKicker>{t('landing.about.vision.kicker')}</CardKicker>
                </div>
                <CardTitle className="text-xl">{t('landing.about.vision.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing.about.vision.description')}</p>
              </CardContent>
            </Card>

            {/* Bloc Fondatrice — fond bg-muted (slate 50) pour se distinguer de la carte Vision.
               Pas de vraie photo fournie : silhouette générique en attendant, plutôt que
               d'inventer des initiales/un nom qui n'existent pas dans le contenu fourni.
               Ajouter <AvatarImage src="..." alt="Prénom Nom" /> ici une fois la photo dispo. */}
            <Card className="bg-muted/40">
              <CardHeader className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <User className="h-7 w-7" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1.5">
                    <CardKicker>{t('landing.about.founder.kicker')}</CardKicker>
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                      {t('landing.about.founder.badge')}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-xl">{t('landing.about.founder.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t('landing.about.founder.description')}</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Separator className="mx-auto my-12 max-w-2xl" />

        <div id="contact" className="mx-auto max-w-2xl scroll-mt-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{t('landing.contact.title')}</h2>
          <p className="mt-3 text-muted-foreground">{t('landing.contact.description')}</p>
          <Button className="mt-6 bg-[#25D366] text-white hover:bg-[#25D366]/90" asChild>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              {t('landing.contact.cta')}
            </a>
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">{t('landing.contact.supportNote')}</p>
        </div>
      </div>
    </section>
  );
}
