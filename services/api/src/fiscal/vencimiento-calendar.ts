export const FiscalObligation = {
  IVA_DDJJ: 'IVA_DDJJ',
  CARGAS_SOCIALES: 'CARGAS_SOCIALES',
  LIBRO_IVA_DIGITAL: 'LIBRO_IVA_DIGITAL',
  MONOTRIBUTO: 'MONOTRIBUTO',
} as const;

export type FiscalObligationType =
  (typeof FiscalObligation)[keyof typeof FiscalObligation];

const OBLIGATION_LABEL: Record<FiscalObligationType, string> = {
  IVA_DDJJ: 'DDJJ IVA',
  CARGAS_SOCIALES: 'Cargas sociales',
  LIBRO_IVA_DIGITAL: 'Libro IVA Digital',
  MONOTRIBUTO: 'Monotributo',
};

export const VencimientoStatus = {
  OVERDUE: 'OVERDUE',
  DUE_SOON: 'DUE_SOON',
  UPCOMING: 'UPCOMING',
} as const;

export type VencimientoStatusType =
  (typeof VencimientoStatus)[keyof typeof VencimientoStatus];

export interface Vencimiento {
  type: FiscalObligationType;
  label: string;
  dueDate: string;
  status: VencimientoStatusType;
}

const FIRST_DIGIT_GROUP_DAY = 18;
const CARGAS_SOCIALES_OFFSET = 4;
const DUE_SOON_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function lastDigitOf(cuit: string): number {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length === 0) return 0;
  return Number(digits[digits.length - 1]);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function safeDate(year: number, month: number, day: number): Date {
  const clamped = Math.min(day, daysInMonth(year, month));
  return new Date(Date.UTC(year, month - 1, clamped));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function computeStatus(dueDate: Date, today: Date): VencimientoStatusType {
  const daysUntil = Math.round((startOfDay(dueDate) - startOfDay(today)) / MS_PER_DAY);
  if (daysUntil < 0) return VencimientoStatus.OVERDUE;
  if (daysUntil <= DUE_SOON_DAYS) return VencimientoStatus.DUE_SOON;
  return VencimientoStatus.UPCOMING;
}

function dueDayFor(
  obligation: FiscalObligationType,
  lastDigit: number,
): number {
  const groupOffset = Math.floor(lastDigit / 2);
  if (obligation === FiscalObligation.CARGAS_SOCIALES) {
    return FIRST_DIGIT_GROUP_DAY - CARGAS_SOCIALES_OFFSET + groupOffset;
  }
  return FIRST_DIGIT_GROUP_DAY + groupOffset;
}

export function upcomingVencimientos(
  cuit: string,
  from: Date,
  to: Date,
  today: Date = new Date(),
): Vencimiento[] {
  const lastDigit = lastDigitOf(cuit);
  const result: Vencimiento[] = [];
  const obligations = Object.values(FiscalObligation);

  let year = from.getUTCFullYear();
  let month = from.getUTCMonth() + 1;
  const endMarker = to.getUTCFullYear() * 12 + to.getUTCMonth();

  while (year * 12 + (month - 1) <= endMarker) {
    for (const obligation of obligations) {
      const dueDate = safeDate(year, month, dueDayFor(obligation, lastDigit));
      if (dueDate.getTime() >= startOfDay(from) && dueDate.getTime() <= startOfDay(to)) {
        result.push({
          type: obligation,
          label: OBLIGATION_LABEL[obligation],
          dueDate: toIsoDate(dueDate),
          status: computeStatus(dueDate, today),
        });
      }
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return result;
}
