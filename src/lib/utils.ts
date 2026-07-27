import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return dateStr;
  }
}

export function formatDateOnly(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy', { locale: es });
  } catch {
    return dateStr;
  }
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('es-CL').format(n);
}

export function padFicha(prefix: string, count: number): string {
  return `${prefix}-${String(count).padStart(3, '0')}`;
}

export function isoDate(y: number, m: number, d: number, h = 8, min = 0): string {
  const dt = new Date(y, m - 1, d, h, min);
  return dt.toISOString();
}
