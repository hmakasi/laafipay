export function buildWhatsAppLink(phone: string | undefined, message: string): string {
  const digits = (phone ?? '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildSmsLink(phone: string | undefined, message: string): string {
  return `sms:${phone ?? ''}?body=${encodeURIComponent(message)}`;
}

export function buildMailtoLink(email: string | undefined, subject: string, message: string): string {
  return `mailto:${email ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
