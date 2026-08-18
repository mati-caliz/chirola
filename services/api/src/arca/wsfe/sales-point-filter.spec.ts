import { emitsCae } from './wsfe.service';

describe('emitsCae', () => {
  it('acepta el CAE comun del responsable inscripto', () => {
    expect(emitsCae('CAE')).toBe(true);
  });

  it('acepta el CAE de monotributo, que ARCA devuelve calificado', () => {
    expect(emitsCae('CAE - Monotributo')).toBe(true);
  });

  it('rechaza CAEA, que es otro mecanismo de emision', () => {
    expect(emitsCae('CAEA')).toBe(false);
    expect(emitsCae('CAEA - Monotributo')).toBe(false);
  });

  it('rechaza los puntos de venta que no emiten por CAE', () => {
    expect(emitsCae('Controlador Fiscal')).toBe(false);
    expect(emitsCae('')).toBe(false);
  });
});
