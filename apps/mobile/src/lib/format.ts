export function formatCurrency(value: number, currency = "PES"): string {
  const code = currency === "PES" ? "ARS" : currency;
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return `$ ${value.toFixed(2)}`;
  }
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const SALES_POINT_DIGITS = 4;
const VOUCHER_NUMBER_DIGITS = 8;

export function formatVoucherNumber(salesPoint: number, number: number): string {
  return `${String(salesPoint).padStart(SALES_POINT_DIGITS, "0")}-${String(number).padStart(VOUCHER_NUMBER_DIGITS, "0")}`;
}
