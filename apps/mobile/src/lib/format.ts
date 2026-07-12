export function formatMoneda(valor: number, moneda = 'PES'): string {
  const code = moneda === 'PES' ? 'ARS' : moneda;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: code,
    }).format(valor);
  } catch {
    return `$ ${valor.toFixed(2)}`;
  }
}

export function formatFecha(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatNumeroCbte(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`;
}
