import { NotFoundException } from "@nestjs/common";
import {
  ExportType,
  issueExportVoucherSchema,
  TaxTreatment,
  VoucherLanguage,
  VoucherStatus,
  VoucherType,
  type IssueExportVoucher,
} from "@chirola/shared";
import type { AuthContext } from "../arca/wsfe/wsfe.types";
import type { ExportCaeRequest, ExportCaeResult } from "../arca/wsfex/wsfex.types";
import { WsfexService } from "../arca/wsfex/wsfex.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";
import { fakeIssuerAuth } from "../issuer-arca/issuer-arca.fixture";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { ExportVouchersService } from "./export-vouchers.service";
import { IssuerLockService } from "./issuer-lock.service";
import { recipientFromQr } from "./qr-image.util";

const OWNER_ID = "user-1";
const LAST_NUMBER = 9;
const LAST_REQUEST_ID = 120;
const FOREIGN_TAX_ID = "50000000016";

const ISSUER = {
  id: "issuer-1",
  userId: OWNER_ID,
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
  cbu: null,
  paymentAlias: null,
};

interface CreatedVoucherData {
  qrData: string;
  exportDetail: unknown;
  [field: string]: unknown;
}

interface CreatedVoucher {
  data: CreatedVoucherData;
  include: unknown;
}

interface Harness {
  service: ExportVouchersService;
  requestedServices: string[];
  authorizeRequests: ExportCaeRequest[];
  salesPointUpserts: unknown[];
  created: CreatedVoucher[];
}

function exportInput(overrides: Record<string, unknown> = {}): IssueExportVoucher {
  return issueExportVoucherSchema.parse({
    issuerId: ISSUER.id,
    salesPoint: 4,
    voucherType: VoucherType.FACTURA_E,
    exportType: ExportType.SERVICES,
    destinationCountryId: 212,
    countryTaxId: FOREIGN_TAX_ID,
    client: { legalName: "Acme Inc", address: "1 Infinite Loop" },
    currency: "DOL",
    exchangeRate: 1300,
    language: VoucherLanguage.ENGLISH,
    items: [
      { description: "Desarrollo", quantity: 2, unitOfMeasureId: 7, unitPrice: 1000, discount: 50 },
      { description: "Soporte", quantity: 1, unitOfMeasureId: 7, unitPrice: 300 },
    ],
    ...overrides,
  });
}

function caeResult(observations: ExportCaeResult["observations"] = []): ExportCaeResult {
  return { cae: "71000000000001", caeVto: new Date(2026, 9, 4), observations, reprocessed: false };
}

async function harness(cae: ExportCaeResult = caeResult()): Promise<Harness> {
  const requestedServices: string[] = [];
  const authorizeRequests: ExportCaeRequest[] = [];
  const salesPointUpserts: unknown[] = [];
  const created: CreatedVoucher[] = [];
  const wsfex = {
    getLastAuthorized: () => Promise.resolve(LAST_NUMBER),
    getLastRequestId: () => Promise.resolve(LAST_REQUEST_ID),
    authorize: (_auth: AuthContext, request: ExportCaeRequest) => {
      authorizeRequests.push(request);
      return Promise.resolve(cae);
    },
  };
  const prisma = {
    issuer: {
      findFirst: ({ where }: { where: { id: string; userId: string } }) =>
        Promise.resolve(where.id === ISSUER.id && where.userId === ISSUER.userId ? ISSUER : null),
    },
    salesPoint: {
      upsert: (args: unknown) => {
        salesPointUpserts.push(args);
        return Promise.resolve({ id: "sales-point-4" });
      },
    },
    voucher: {
      create: (args: CreatedVoucher) => {
        created.push(args);
        return Promise.resolve({ id: "voucher-1", ...args.data });
      },
    },
  };
  const service = await instantiateWithDoubles(ExportVouchersService, [
    { token: PrismaService, value: prisma },
    { token: IssuerAuthService, value: fakeIssuerAuth(requestedServices) },
    { token: WsfexService, value: wsfex },
    { token: IssuerLockService, value: new IssuerLockService() },
  ]);
  return { service, requestedServices, authorizeRequests, salesPointUpserts, created };
}

describe("ExportVouchersService access", () => {
  it("rejects a missing issuer before talking to ARCA", async () => {
    const { service, authorizeRequests } = await harness();

    await expect(service.issue(OWNER_ID, exportInput({ issuerId: "missing" }))).rejects.toThrow(
      new NotFoundException("Emisor inexistente."),
    );
    expect(authorizeRequests).toEqual([]);
  });

  it("hides an issuer owned by another user as missing", async () => {
    const { service, authorizeRequests, created } = await harness();

    await expect(service.issue("user-2", exportInput())).rejects.toThrow(NotFoundException);
    expect(authorizeRequests).toEqual([]);
    expect(created).toEqual([]);
  });
});

describe("ExportVouchersService.issue", () => {
  it("authorizes against WSFEX with the next number and request id", async () => {
    const { service, requestedServices, authorizeRequests } = await harness();

    await service.issue(OWNER_ID, exportInput());

    expect(requestedServices).toEqual(["wsfex"]);
    expect(authorizeRequests).toEqual([
      expect.objectContaining({
        requestId: LAST_REQUEST_ID + 1,
        number: LAST_NUMBER + 1,
        salesPoint: 4,
        voucherType: VoucherType.FACTURA_E,
        totalAmount: 2250,
        shippingPermits: [],
        associatedVouchers: [],
      }),
    ]);
  });

  it("stores an approved export voucher as fully exempt, scoped to the issuer", async () => {
    const { service, salesPointUpserts, created } = await harness();

    await service.issue(OWNER_ID, exportInput());

    expect(salesPointUpserts).toEqual([
      {
        where: { issuerId_number: { issuerId: ISSUER.id, number: 4 } },
        create: { issuerId: ISSUER.id, number: 4 },
        update: {},
      },
    ]);
    const data = created[0]?.data;
    expect(data).toEqual(
      expect.objectContaining({
        issuerId: ISSUER.id,
        salesPointId: "sales-point-4",
        recipientDocType: 80,
        recipientDocNumber: FOREIGN_TAX_ID,
        recipientName: "Acme Inc",
        number: LAST_NUMBER + 1,
        netAmount: 0,
        ivaAmount: 0,
        exemptAmount: 2250,
        totalAmount: 2250,
        status: VoucherStatus.APPROVED,
        cae: "71000000000001",
        items: {
          create: [
            expect.objectContaining({ subtotal: 1950, ivaRate: 0, taxTreatment: TaxTreatment.EXEMPT }),
            expect.objectContaining({ subtotal: 300, ivaRate: 0, taxTreatment: TaxTreatment.EXEMPT }),
          ],
        },
      }),
    );
    expect(data?.exportDetail).toEqual({
      exportType: ExportType.SERVICES,
      destinationCountryId: 212,
      countryTaxId: FOREIGN_TAX_ID,
      clientLegalName: "Acme Inc",
      clientAddress: "1 Infinite Loop",
      clientTaxId: null,
      language: VoucherLanguage.ENGLISH,
      incoterm: null,
      paymentMethod: null,
      shippingPermits: [],
      requestId: LAST_REQUEST_ID + 1,
    });
    expect(data).not.toHaveProperty("arcaObservations");
    expect(data).not.toHaveProperty("associatedVouchers");
  });

  it("encodes the foreign recipient in the QR", async () => {
    const { service, created } = await harness();

    await service.issue(OWNER_ID, exportInput());

    expect(recipientFromQr(created[0]?.data.qrData ?? "")).toEqual({
      docType: 80,
      docNumber: FOREIGN_TAX_ID,
    });
  });

  it("marks the voucher observed and keeps ARCA observations", async () => {
    const observations = [{ code: "1234", message: "Revisar destino" }];
    const { service, created } = await harness(caeResult(observations));

    await service.issue(OWNER_ID, exportInput());

    expect(created[0]?.data).toEqual(
      expect.objectContaining({ status: VoucherStatus.OBSERVED, arcaObservations: observations }),
    );
  });

  it("forwards goods details, permits and associated vouchers", async () => {
    const shippingPermits = [{ permitId: "16033EC01", destinationCountryId: 212 }];
    const associatedVouchers = [{ type: VoucherType.FACTURA_E, salesPoint: 4, number: 3 }];
    const { service, authorizeRequests, created } = await harness();

    await service.issue(
      OWNER_ID,
      exportInput({
        voucherType: VoucherType.NOTA_CREDITO_E,
        exportType: ExportType.GOODS,
        incoterm: "FOB",
        paymentMethod: "Transferencia",
        client: { legalName: "Acme Inc", address: "1 Infinite Loop", taxId: "US-123" },
        shippingPermits,
        associatedVouchers,
      }),
    );

    expect(authorizeRequests[0]).toEqual(expect.objectContaining({ shippingPermits, associatedVouchers }));
    const data = created[0]?.data;
    expect(data).toEqual(expect.objectContaining({ associatedVouchers }));
    expect(data?.exportDetail).toEqual(
      expect.objectContaining({
        clientTaxId: "US-123",
        incoterm: "FOB",
        paymentMethod: "Transferencia",
        shippingPermits,
      }),
    );
  });

  it("does not store an empty list of associated vouchers", async () => {
    const { service, created } = await harness();

    await service.issue(OWNER_ID, exportInput({ associatedVouchers: [] }));

    expect(created[0]?.data).not.toHaveProperty("associatedVouchers");
  });
});
