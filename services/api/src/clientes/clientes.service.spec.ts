import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../prisma/prisma.service';

/** Prisma en memoria para el modelo `cliente`, con unique (emisor,tipoDoc,numeroDoc). */
function fakePrisma(): PrismaService {
  const store = new Map<string, any>();
  let seq = 0;
  const key = (r: any) => `${r.emisorId}|${r.tipoDoc}|${r.numeroDoc}`;
  return {
    cliente: {
      create: async ({ data }: any) => {
        for (const r of store.values()) {
          if (key(r) === key(data)) {
            throw new Prisma.PrismaClientKnownRequestError('dup', {
              code: 'P2002',
              clientVersion: 'test',
            });
          }
        }
        const row = { id: `cli${++seq}`, razonSocial: null, condicionIva: null, email: null, ...data };
        store.set(row.id, row);
        return row;
      },
      findMany: async ({ where }: any) =>
        [...store.values()].filter((r) => r.emisorId === where.emisorId),
      findFirst: async ({ where }: any) =>
        [...store.values()].find(
          (r) => r.id === where.id && r.emisorId === where.emisorId,
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

describe('ClientesService', () => {
  const EM = 'em1';
  let svc: ClientesService;

  beforeEach(() => {
    svc = new ClientesService(fakePrisma());
  });

  it('crea y lista clientes de un emisor', async () => {
    await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745', razonSocial: 'Acme' });
    await svc.crear(EM, { tipoDoc: 96, numeroDoc: '12345678', razonSocial: 'Beta' });
    const lista = await svc.listar(EM);
    expect(lista).toHaveLength(2);
  });

  it('rechaza documento duplicado en el mismo emisor con 409', async () => {
    await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745' });
    await expect(
      svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('el mismo documento en otro emisor sí se permite', async () => {
    await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745' });
    await expect(
      svc.crear('em2', { tipoDoc: 80, numeroDoc: '30707153745' }),
    ).resolves.toMatchObject({ emisorId: 'em2' });
  });

  it('no encuentra un cliente de otro emisor (aislamiento)', async () => {
    const c = await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745' });
    await expect(svc.obtener('em2', c.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('actualiza sólo los campos provistos', async () => {
    const c = await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745', razonSocial: 'Acme' });
    const upd = await svc.actualizar(EM, c.id, { email: 'x@acme.com' });
    expect(upd.email).toBe('x@acme.com');
    expect(upd.razonSocial).toBe('Acme');
  });

  it('elimina un cliente propio', async () => {
    const c = await svc.crear(EM, { tipoDoc: 80, numeroDoc: '30707153745' });
    await expect(svc.eliminar(EM, c.id)).resolves.toEqual({ ok: true });
    await expect(svc.obtener(EM, c.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
