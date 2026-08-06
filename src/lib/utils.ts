import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format currency in XOF (Franc CFA)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-BF', {
    style: 'currency',
    currency: 'XOF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format a date string to French locale
export function formatDate(dateStr: string, fmt = 'dd/MM/yyyy'): string {
  try {
    return format(parseISO(dateStr), fmt, { locale: fr });
  } catch {
    return dateStr;
  }
}

// Format period "2025-07" -> "Juillet 2025"
export function formatPeriod(period: string): string {
  try {
    const [year, month] = period.split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1, 1), 'MMMM yyyy', { locale: fr });
  } catch {
    return period;
  }
}

// Days between two dates
export function daysBetween(start: string, end: string): number {
  try {
    return differenceInDays(parseISO(end), parseISO(start)) + 1;
  } catch {
    return 0;
  }
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Phone number format validation (Burkina Faso)
export function isValidBFPhone(phone: string): boolean {
  // BF numbers: starts with +226 or 0, 8 digits
  const cleaned = phone.replace(/\s+/g, '');
  return /^(\+226)?[0-9]{8}$/.test(cleaned);
}

// Simulate API delay (used in mocks)
export function delay(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deep clone
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Generate a mock transaction reference
export function generateRef(prefix = 'TXN'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
}

// Download a blob
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Export array to CSV
export function arrayToCSV(data: Record<string, unknown>[], headers: Record<string, string>): string {
  const headerRow = Object.values(headers).join(';');
  const rows = data.map((item) =>
    Object.keys(headers)
      .map((key) => {
        const val = item[key];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape semicolons and quotes
        return str.includes(';') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      })
      .join(';')
  );
  return [headerRow, ...rows].join('\n');
}
