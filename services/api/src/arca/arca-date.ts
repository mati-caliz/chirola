const YEAR_END = 4;
const MONTH_END = 6;
const DAY_END = 8;

export function toArcaDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function parseArcaDate(value: string): Date {
  const year = Number(value.slice(0, YEAR_END));
  const month = Number(value.slice(YEAR_END, MONTH_END));
  const day = Number(value.slice(MONTH_END, DAY_END));
  return new Date(year, month - 1, day);
}

export function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
