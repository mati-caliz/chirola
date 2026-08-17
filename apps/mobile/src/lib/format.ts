export function formatCurrency(value: number, currency = 'PES'): string {
  const code = currency === 'PES' ? 'ARS' : currency;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: code,
    }).format(value);
  } catch {
    return `$ ${value.toFixed(2)}`;
  }
}

export function formatDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatVoucherNumber(salesPoint: number, number: number): string {
  return `${String(salesPoint).padStart(4, '0')}-${String(number).padStart(8, '0')}`;
}
