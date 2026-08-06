import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Copy, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { buildMailtoLink, buildSmsLink, buildWhatsAppLink } from '@/lib/shareLinks';

interface InviteResultDialogProps {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  phone?: string;
  email?: string;
  link: string;
}

export function InviteResultDialog({ open, onClose, employeeName, phone, email, link }: InviteResultDialogProps) {
  const { t } = useTranslation();
  const message = t('employees.invite.message', { name: employeeName, link });

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast.success(t('employees.invite.copied'));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('employees.invite.title')}</DialogTitle>
          <DialogDescription>{t('employees.invite.description', { name: employeeName })}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input readOnly value={link} />
          <Button type="button" variant="outline" onClick={copyLink}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button type="button" variant="outline" asChild>
            <a href={buildWhatsAppLink(phone, message)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={buildSmsLink(phone, message)}>
              <Smartphone className="mr-2 h-4 w-4" />
              SMS
            </a>
          </Button>
          <Button type="button" variant="outline" asChild>
            <a href={buildMailtoLink(email, t('employees.invite.emailSubject'), message)}>
              <Mail className="mr-2 h-4 w-4" />
              E-mail
            </a>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            {t('app.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
