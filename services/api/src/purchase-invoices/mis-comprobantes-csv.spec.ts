import {
  CsvFormatError,
  parseArcaAmount,
  parseArcaDate,
  parseMisComprobantesCsv,
} from './mis-comprobantes-csv';

const HEADER =
  'Fecha;Tipo;Punto de Venta;Número Desde;Número Hasta;Nro. Doc. Emisor;' +
  'Denominación Emisor;Imp. Neto Gravado;Imp. Neto No Gravado;Imp. Op. Exentas;IVA;Imp. Total';

const ROW =
  '12/07/2026;1;5;123;123;30707153745;Proveedor SA;1000,00;0,00;0,00;210,00;1210,00';

describe('parseArcaAmount', () => {
  it('lee el formato argentino con punto de miles y coma decimal', () => {
    expect(parseArcaAmount('1.234,56')).toBe(1234.56);
  });

  it('lee el formato con punto decimal', () => {
    expect(parseArcaAmount('1234.56')).toBe(1234.56);
  });

  it('trata la celda vacía como cero', () => {
    expect(parseArcaAmount('')).toBe(0);
  });

  it('rechaza un importe ilegible', () => {
    expect(() => parseArcaAmount('mil pesos')).toThrow(CsvFormatError);
  });
});

describe('parseArcaDate', () => {
  it('convierte dd/mm/aaaa a ISO', () => {
    expect(parseArcaDate('12/07/2026')).toBe('2026-07-12');
  });

  it('acepta una fecha que ya viene en ISO', () => {
    expect(parseArcaDate('2026-07-12')).toBe('2026-07-12');
  });

  it('rechaza una fecha ilegible', () => {
    expect(() => parseArcaDate('julio')).toThrow(CsvFormatError);
  });
});

describe('parseMisComprobantesCsv', () => {
  it('parsea una fila del export de ARCA', () => {
    const { rows, invalid } = parseMisComprobantesCsv(`${HEADER}\n${ROW}`);

    expect(invalid).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      supplierCuit: '30707153745',
      supplierName: 'Proveedor SA',
      invoiceType: 1,
      salesPoint: 5,
      number: 123,
      issueDate: '2026-07-12',
      netTaxed: 1000,
      ivaAmount: 210,
      total: 1210,
    });
  });

  it('acepta el archivo separado por comas', () => {
    const csv = `${HEADER.replace(/;/g, ',')}\n${ROW.replace(/;/g, ',').replace(/,00/g, '.00')}`;

    expect(parseMisComprobantesCsv(csv).rows).toHaveLength(1);
  });

  it('tolera el BOM y los encabezados con acentos', () => {
    const { rows } = parseMisComprobantesCsv(`﻿${HEADER}\n${ROW}`);

    expect(rows).toHaveLength(1);
  });

  it('respeta las comillas alrededor de una razón social con separador adentro', () => {
    const row = ROW.replace('Proveedor SA', '"Proveedor SA; Sucursal Norte"');
    const { rows } = parseMisComprobantesCsv(`${HEADER}\n${row}`);

    expect(rows[0].supplierName).toBe('Proveedor SA; Sucursal Norte');
  });

  it('junta las filas ilegibles en vez de abortar el archivo entero', () => {
    const broken = ROW.replace('30707153745', '123');
    const { rows, invalid } = parseMisComprobantesCsv(
      `${HEADER}\n${ROW}\n${broken}\n${ROW.replace(';123;', ';124;')}`,
    );

    expect(rows).toHaveLength(2);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].line).toBe(3);
    expect(invalid[0].reason).toContain('CUIT');
  });

  it('rechaza un archivo que no es el de Mis Comprobantes', () => {
    expect(() => parseMisComprobantesCsv('columna1;columna2\n1;2')).toThrow(
      CsvFormatError,
    );
  });

  it('rechaza un archivo vacío', () => {
    expect(() => parseMisComprobantesCsv('   ')).toThrow(CsvFormatError);
  });
});
