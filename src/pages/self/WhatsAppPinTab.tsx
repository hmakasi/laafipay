import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { setWhatsAppPin } from '@/services/api/auth';

export function WhatsAppPinTab() {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pinValid = /^\d{4}$/.test(pin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinValid) {
      toast.error(t('self.whatsappPin.invalid'));
      return;
    }
    if (pin !== confirmPin) {
      toast.error(t('self.whatsappPin.mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      await setWhatsAppPin(pin);
      toast.success(t('self.whatsappPin.success'));
      setPin('');
      setConfirmPin('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div>
        <h2 className="text-lg font-medium">{t('self.whatsappPin.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('self.whatsappPin.description')}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-pin">{t('self.whatsappPin.pinLabel')}</Label>
        <Input id="whatsapp-pin" type="password" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="whatsapp-pin-confirm">{t('self.whatsappPin.confirmLabel')}</Label>
        <Input id="whatsapp-pin-confirm" type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Button type="submit" disabled={submitting}>
        {t('self.whatsappPin.submit')}
      </Button>
    </form>
  );
}
