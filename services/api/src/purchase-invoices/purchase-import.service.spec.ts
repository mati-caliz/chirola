import { BadRequestException } from '@nestjs/common';
import {
  ImportRowStatus,
  PurchaseImportService,
} from './purchase-import.service';
import type { PrismaService } from '../prisma/prisma.service';

const HEADER =
  'Fecha;Tipo;Punto de Venta;Número Desde;Nro. Doc. Emisor;' +
  'Denominación Emisor;Imp. Neto Gravado;Imp. Neto No Gravado;Imp. Op. Exentas;IVA;Imp. Total';

interface ExistingKey {
  supplierCuit: string;
  invoiceType: number;
  salesPoint: number;
  number: number;
}

interface CreatedInvoice {
  supplierCuit: string;
  number: number;
  netAmount21: number;
  iva21: number;
  netAmount105: number;
  iva105: number;
  total: number;
}

function build(existing: ExistingKey[] = []) {
  const created: CreatedInvoice[] = [];
  const prisma = {
    purchaseInvoice: {
      findMany: async () => existing,
      create: async ({ data }: { data: CreatedInvoice }) => {
        created.push(data);
        return data;
      },
    },
  } as unknown as PrismaService;

  return { service: new PurchaseImportService(prisma), created };
}

const row = (overrides: Partial<Record<string, string>> = {}): string => {
  const fields = {
    date: '12/07/2026',
    type: '1',
    salesPoint: '5',
    number: '123',
    cuit: '30707153745',
    name: 'Proveedor SA',
    netTaxed: '1000,00',
    untaxed: '0,00',
    exempt: '0,00',
    iva: '210,00',
    total: '1210,00',
    ...overrides,
  };
  return [
    fields.date,
    fields.type,
    fields.salesPoint,
    fields.number,
    fields.cuit,
    fields.name,
    fields.netTaxed,
    fields.untaxed,
    fields.exempt,
    fields.iva,
    fields.total,
  ].join(';');
};

const csvOf = (...rows: string[]): string => [HEADER, ...rows].join('\n');

describe('PurchaseImportService — preview (E.1)', () => {
  it('marca como importable una factura nueva y deduce la alícuota', async () => {
    const { service } = build();

    const preview = await service.preview('issuer-1', csvOf(row()));

    expect(preview.rows[0].status).toBe(ImportRowStatus.IMPORTABLE);
    expect(preview.rows[0].ivaRate).toBe(21);
    expect(preview.summary.importable).toBe(1);
  });

  it('deduce la alícuota del 10,5%', async () => {
    const { service } = build();

    const preview = await service.preview(
      'issuer-1',
      csvOf(row({ iva: '105,00', total: '1105,00' })),
    );

    expect(preview.rows[0].ivaRate).toBe(10.5);
  });

  it('marca como duplicada la factura que ya está cargada', async () => {
    const { service } = build([
      { supplierCuit: '30707153745', invoiceType: 1, salesPoint: 5, number: 123 },
    ]);

    const preview = await service.preview('issuer-1', csvOf(row()));

    expect(preview.rows[0].status).toBe(ImportRowStatus.DUPLICATE);
    expect(preview.summary.duplicates).toBe(1);
  });

  it('manda a revisión la factura con más de una alícuota', async () => {
    const { service } = build();

    const preview = await service.preview(
      'issuer-1',
      csvOf(row({ iva: '160,00', total: '1160,00' })),
    );

    expect(preview.rows[0].status).toBe(ImportRowStatus.NEEDS_REVIEW);
    expect(preview.rows[0].reason).toContain('alícuota');
  });

  it('manda a revisión la factura cuyo total no cierra con los importes', async () => {
    const { service } = build();

    const preview = await service.preview(
      'issuer-1',
      csvOf(row({ total: '1500,00' })),
    );

    expect(preview.rows[0].status).toBe(ImportRowStatus.NEEDS_REVIEW);
    expect(preview.rows[0].reason).toContain('otros tributos');
  });

  it('cuenta las filas ilegibles aparte', async () => {
    const { service } = build();

    const preview = await service.preview(
      'issuer-1',
      csvOf(row(), row({ cuit: '123', number: '124' })),
    );

    expect(preview.summary.importable).toBe(1);
    expect(preview.summary.invalid).toBe(1);
  });

  it('rechaza un archivo que no es el de Mis Comprobantes', async () => {
    const { service } = build();

    await expect(service.preview('issuer-1', 'a;b\n1;2')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('no escribe nada en la vista previa', async () => {
    const { service, created } = build();

    await service.preview('issuer-1', csvOf(row()));

    expect(created).toHaveLength(0);
  });
});

describe('PurchaseImportService — import (E.1)', () => {
  it('importa sólo las filas importables', async () => {
    const { service, created } = build([
      { supplierCuit: '30707153745', invoiceType: 1, salesPoint: 5, number: 900 },
    ]);

    const result = await service.import(
      'issuer-1',
      csvOf(
        row(),
        row({ number: '900' }),
        row({ number: '901', iva: '160,00', total: '1160,00' }),
      ),
    );

    expect(created).toHaveLength(1);
    expect(created[0].number).toBe(123);
    expect(result.summary).toMatchObject({
      importable: 1,
      duplicates: 1,
      needsReview: 1,
    });
  });

  it('guarda los importes en la columna de la alícuota deducida', async () => {
    const { service, created } = build();

    await service.import(
      'issuer-1',
      csvOf(row({ number: '5', iva: '105,00', total: '1105,00' })),
    );

    expect(created[0].netAmount105).toBe(1000);
    expect(created[0].iva105).toBe(105);
    expect(created[0].netAmount21).toBe(0);
    expect(created[0].total).toBe(1105);
  });
});
