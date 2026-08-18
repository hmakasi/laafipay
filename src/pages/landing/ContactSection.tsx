import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WHATSAPP_NUMBER = '221781508698';
const WHATSAPP_MESSAGE = "Bonjour, j'ai une question concernant LaafiPay";
const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

// Extrait de l'ancien AboutContactSection.tsx : AboutSection.tsx ne doit
// désormais contenir que le contenu "À propos" (en-tête + vision/fondatrice
// + engagements), le Contact devient sa propre section.
export function ContactSection() {
  const { t } = useTranslation();

  return (
    <section className="py-16 md:py-24">
      <div className="container">
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
