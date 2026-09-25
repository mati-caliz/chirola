import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma, type Client } from "@prisma/client";
import { DocumentType } from "@chirola/shared";
import { ClientsService } from "./clients.service";
import { PrismaService } from "../prisma/prisma.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

type NewClient = Pick<Client, "issuerId" | "docType" | "docNumber"> & Partial<Client>;

const EXPECTED_CLIENT_COUNT = 2;

function uniqueKey(row: Pick<Client, "issuerId" | "docType" | "docNumber">): string {
  return `${row.issuerId}|${String(row.docType)}|${row.docNumber}`;
}

function fakePrisma() {
  const store = new Map<string, Client>();
  let sequence = 0;
  return {
    client: {
      create: ({ data }: { data: NewClient }) => {
        for (const existing of store.values()) {
          if (uniqueKey(existing) === uniqueKey(data)) {
            return Promise.reject(
              new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "test" }),
            );
          }
        }
        const row: Client = {
          id: `cli${String(++sequence)}`,
          legalName: null,
          ivaCondition: null,
          email: null,
          ...data,
        };
        store.set(row.id, row);
        return Promise.resolve(row);
      },
      findMany: ({ where }: { where: { issuerId: string } }) =>
        Promise.resolve([...store.values()].filter((row) => row.issuerId === where.issuerId)),
      findFirst: ({ where }: { where: { id: string; issuerId: string } }) =>
        Promise.resolve(
          [...store.values()].find((row) => row.id === where.id && row.issuerId === where.issuerId) ?? null,
        ),
      update: ({ where, data }: { where: { id: string }; data: Partial<Client> }) => {
        const existing = store.get(where.id);
        if (existing === undefined) return Promise.reject(new Error("Cliente inexistente en el doble."));
        const row: Client = { ...existing, ...data };
        store.set(where.id, row);
        return Promise.resolve(row);
      },
      delete: ({ where }: { where: { id: string } }) => {
        store.delete(where.id);
        return Promise.resolve({});
      },
    },
  };
}

describe("ClientsService", () => {
  const ISSUER = "em1";
  let service: ClientsService;

  beforeEach(async () => {
    service = await instantiateWithDoubles(ClientsService, [{ token: PrismaService, value: fakePrisma() }]);
  });

  it("crea y lista clientes de un emisor", async () => {
    await service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745", legalName: "Acme" });
    await service.create(ISSUER, { docType: DocumentType.DNI, docNumber: "12345678", legalName: "Beta" });
    const clients = await service.list(ISSUER);
    expect(clients).toHaveLength(EXPECTED_CLIENT_COUNT);
  });

  it("rechaza documento duplicado en el mismo emisor con 409", async () => {
    await service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745" });
    await expect(
      service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745" }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("el mismo documento en otro emisor sí se permite", async () => {
    await service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745" });
    await expect(
      service.create("em2", { docType: DocumentType.CUIT, docNumber: "30707153745" }),
    ).resolves.toMatchObject({ issuerId: "em2" });
  });

  it("no encuentra un cliente de otro emisor (aislamiento)", async () => {
    const client = await service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745" });
    await expect(service.get("em2", client.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("actualiza sólo los campos provistos", async () => {
    const client = await service.create(ISSUER, {
      docType: DocumentType.CUIT,
      docNumber: "30707153745",
      legalName: "Acme",
    });
    const updated = await service.update(ISSUER, client.id, { email: "x@acme.com" });
    expect(updated.email).toBe("x@acme.com");
    expect(updated.legalName).toBe("Acme");
  });

  it("elimina un cliente propio", async () => {
    const client = await service.create(ISSUER, { docType: DocumentType.CUIT, docNumber: "30707153745" });
    await expect(service.delete(ISSUER, client.id)).resolves.toEqual({ ok: true });
    await expect(service.get(ISSUER, client.id)).rejects.toBeInstanceOf(NotFoundException);
  });
});
