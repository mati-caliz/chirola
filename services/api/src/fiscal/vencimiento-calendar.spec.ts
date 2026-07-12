import {
  upcomingVencimientos,
  FiscalObligation,
  VencimientoStatus,
} from './vencimiento-calendar';

describe('upcomingVencimientos', () => {
  const cuit = '20111111112';

  it('genera las cuatro obligaciones dentro del mes', () => {
    const from = new Date(Date.UTC(2026, 6, 1));
    const to = new Date(Date.UTC(2026, 6, 31));
    const result = upcomingVencimientos(cuit, from, to, from);

    const types = new Set(result.map((item) => item.type));
    expect(types).toEqual(
      new Set([
        FiscalObligation.IVA_DDJJ,
        FiscalObligation.CARGAS_SOCIALES,
        FiscalObligation.LIBRO_IVA_DIGITAL,
        FiscalObligation.MONOTRIBUTO,
      ]),
    );
  });

  it('ordena por fecha ascendente', () => {
    const from = new Date(Date.UTC(2026, 6, 1));
    const to = new Date(Date.UTC(2026, 7, 31));
    const result = upcomingVencimientos(cuit, from, to, from);

    const dates = result.map((item) => item.dueDate);
    expect(dates).toEqual([...dates].sort());
  });

  it('computa el día según el último dígito del CUIT (terminación 2 → grupo día 19)', () => {
    const from = new Date(Date.UTC(2026, 6, 1));
    const to = new Date(Date.UTC(2026, 6, 31));
    const result = upcomingVencimientos(cuit, from, to, from);
    const ivaDdjj = result.find((item) => item.type === FiscalObligation.IVA_DDJJ);
    expect(ivaDdjj?.dueDate).toBe('2026-07-19');
  });

  it('marca OVERDUE / DUE_SOON / UPCOMING según la fecha de hoy', () => {
    const from = new Date(Date.UTC(2026, 6, 1));
    const to = new Date(Date.UTC(2026, 6, 31));
    const today = new Date(Date.UTC(2026, 6, 17));
    const result = upcomingVencimientos(cuit, from, to, today);

    const ivaDdjj = result.find((item) => item.type === FiscalObligation.IVA_DDJJ);
    expect(ivaDdjj?.status).toBe(VencimientoStatus.DUE_SOON);

    const cargas = result.find(
      (item) => item.type === FiscalObligation.CARGAS_SOCIALES,
    );
    expect(cargas?.status).toBe(VencimientoStatus.OVERDUE);
  });

  it('no incluye vencimientos fuera del rango', () => {
    const from = new Date(Date.UTC(2026, 6, 20));
    const to = new Date(Date.UTC(2026, 6, 25));
    const result = upcomingVencimientos(cuit, from, to, from);
    for (const item of result) {
      expect(item.dueDate >= '2026-07-20').toBe(true);
      expect(item.dueDate <= '2026-07-25').toBe(true);
    }
  });
});
