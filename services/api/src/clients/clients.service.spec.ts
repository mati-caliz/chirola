import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientsService } from './clients.service';
import { PrismaService } from '../prisma/prisma.service';

function fakePrisma(): PrismaService {
  const store = new Map<string, any>();
  let seq = 0;
  const key = (r: any) => `${r.issuerId}|${r.docType}|${r.docNumber}`;
  return {
    client: {
      create: async ({ data }: any) => {
        for (const r of store.values()) {
          if (key(r) === key(data)) {
            throw new Prisma.PrismaClientKnownRequestError('dup', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
        }
        const row = { id: `cli${++seq}`, legalName: null, ivaCondition: null, email: null, ...data };
        store.set(row.id, row);
        return row;
      },
      findMany: async ({ where }: any) =>
        [...store.values()].filter((r) => r.issuerId === where.issuerId),
      findFirst: async ({ where }: any) =>
        [...store.values()].find(
          (r) => r.id === where.id && r.issuerId === where.issuerId,
        ) ?? null,
      update: async ({ where, data }: any) => {
        const row = { ...store.get(where.id) };
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) row[k] = v;
        }
        store.set(where.id, row);
        return row;
      },
      delete: async ({ where }: any) => {
        store.delete(where.id);
        return {};
      },
    },
  } as unknown as PrismaService;
}

describe('ClientsService', () => {
  const ISSUER = 'em1';
  let svc: ClientsService;

  beforeEach(() => {
    svc = new ClientsService(fakePrisma());
  });

  it('crea y lista clientes de un emisor', async () => {
    await svc.create(ISSUER, { docType: 80, docNumber: '30707153745', legalName: 'Acme' });
    await svc.create(ISSUER, { docType: 96, docNumber: '12345678', legalName: 'Beta' });
    const lista = await svc.list(ISSUER);
    expect(lista).toHaveLength(2);
  });

  it('rechaza documento duplicado en el mismo emisor con 409', async () => {
    await svc.create(ISSUER, { docType: 80, docNumber: '30707153745' });
    await expect(
      svc.create(ISSUER, { docType: 80, docNumber: '30707153745' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el mismo documento en otro emisor sí se permite', async () => {
    await svc.create(ISSUER, { docType: 80, docNumber: '30707153745' });
    await expect(
      svc.create('em2', { docType: 80, docNumber: '30707153745' }),
    ).resolves.toMatchObject({ issuerId: 'em2' });
  });

  it('no encuentra un cliente de otro emisor (aislamiento)', async () => {
    const c = await svc.create(ISSUER, { docType: 80, docNumber: '30707153745' });
    await expect(svc.get('em2', c.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza sólo los campos provistos', async () => {
    const c = await svc.create(ISSUER, { docType: 80, docNumber: '30707153745', legalName: 'Acme' });
    const upd = await svc.update(ISSUER, c.id, { email: 'x@acme.com' });
    expect(upd.email).toBe('x@acme.com');
    expect(upd.legalName).toBe('Acme');
  });

  it('elimina un cliente propio', async () => {
    const c = await svc.create(ISSUER, { docType: 80, docNumber: '30707153745' });
    await expect(svc.delete(ISSUER, c.id)).resolves.toEqual({ ok: true });
    await expect(svc.get(ISSUER, c.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
