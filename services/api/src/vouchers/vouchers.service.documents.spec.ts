import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { IssuerOnboardingStatus, type IssueVoucher } from "@chirola/shared";
import { fakeIssuerAuth, fakeIssuerOnboarding } from "../issuer-arca/issuer-arca.fixture";
import { EmissionPlanService } from "./emission-plan.service";
import { VoucherAccessService } from "./voucher-access.service";
import { buildVoucherDetail } from "./voucher-detail.fixture";
import { buildInput } from "./voucher-emission.fixture";
import type { IssuedVoucher, StoredIssuer } from "./voucher-emission.types";
import { VoucherEmissionService } from "./voucher-emission.service";
import type { IssuerGrants, WsfeGateway } from "./voucher-ports";
import type { EmissionPlanTables, VoucherAccessTables, VoucherDetail } from "./voucher-tables";
import { VouchersService } from "./vouchers.service";
import { instantiateWithDoubles } from "../common/testing/instantiate-with-doubles";

const OWNER_ID = "user-1";
const STRANGER_ID = "user-2";
const API_CLIENT = { id: "client-1", name: "respondi" };
const LAST_AUTHORIZED = 41;
const PDF_MAGIC = "%PDF";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

const ISSUER: StoredIssuer = {
  id: "issuer-1",
  userId: OWNER_ID,
  cuit: "20111111112",
  environment: "homologacion",
  representativeCuit: null,
  cbu: null,
  paymentAlias: null,
};

const ISSUED: IssuedVoucher = {
  id: "voucher-1",
  voucherType: 11,
  salesPoint: 1,
  number: 1,
  cae: "74000000000001",
  caeExpiration: new Date(2026, 8, 30),
  netAmount: 100,
  ivaAmount: 0,
  totalAmount: 100,
  qrData: "qr",
};

interface Harness {
  service: VouchersService;
  issued: { issuerId: string; idempotencyKey: string | undefined }[];
  grantChecks: string[];
}

function accessWith(
  vouchers: VoucherDetail[],
  grantedIssuerIds: string[],
): {
  access: VoucherAccessService;
  grantChecks: string[];
} {
  const grantChecks: string[] = [];
  const tables: VoucherAccessTables = {
    issuer: { findUnique: ({ where }) => Promise.resolve(where.id === ISSUER.id ? ISSUER : null) },
    voucher: {
      findUnique: ({ where }) => Promise.resolve(vouchers.find((voucher) => voucher.id === where.id) ?? null),
      findMany: ({ where }) =>
        Promise.resolve(vouchers.filter((voucher) => voucher.issuerId === where.issuerId).map(listEntryOf)),
    },
  };
  const grants: IssuerGrants = {
    assertIssuerGranted: (_apiClientId, issuerId) => {
      grantChecks.push(issuerId);
      return grantedIssuerIds.includes(issuerId)
        ? Promise.resolve()
        : Promise.reject(new ForbiddenException("El emisor no está habilitado para este cliente."));
    },
  };
  return { access: new VoucherAccessService(tables, grants), grantChecks };
}

function listEntryOf(
  voucher: VoucherDetail,
): Awaited<ReturnType<VoucherAccessTables["voucher"]["findMany"]>>[number] {
  return {
    id: voucher.id,
    voucherType: voucher.voucherType,
    number: voucher.number,
    voucherDate: voucher.voucherDate,
    status: voucher.status,
    cae: voucher.cae,
    totalAmount: voucher.totalAmount,
    currency: voucher.currency,
    recipientName: voucher.recipientName,
    salesPoint: { number: voucher.salesPoint.number },
    client: null,
  };
}

function emissionPlans(): EmissionPlanService {
  const tables: EmissionPlanTables = {
    issuer: {
      findUniqueOrThrow: () =>
        Promise.resolve({ onboardingStatus: IssuerOnboardingStatus.ISSUING_CONFIRMED }),
    },
  };
  const notUsed = (): Promise<never> => Promise.reject(new Error("No se usa en estos tests."));
  const wsfe: WsfeGateway = {
    getLastAuthorized: () => Promise.resolve(LAST_AUTHORIZED),
    requestCae: notUsed,
    queryVoucher: notUsed,
    queryVoucherDetail: notUsed,
  };
  return new EmissionPlanService(tables, fakeIssuerAuth(), fakeIssuerOnboarding(), wsfe);
}

async function harness(
  options: { vouchers?: VoucherDetail[]; grantedIssuerIds?: string[] } = {},
): Promise<Harness> {
  const { vouchers = [buildVoucherDetail()], grantedIssuerIds = [ISSUER.id] } = options;
  const { access, grantChecks } = accessWith(vouchers, grantedIssuerIds);
  const issued: Harness["issued"] = [];
  const issueAuthorized = (
    issuer: StoredIssuer,
    _input: IssueVoucher,
    idempotencyKey?: string,
  ): Promise<IssuedVoucher> => {
    issued.push({ issuerId: issuer.id, idempotencyKey });
    return Promise.resolve(ISSUED);
  };
  const service = await instantiateWithDoubles(VouchersService, [
    { token: VoucherAccessService, value: access },
    { token: VoucherEmissionService, value: { issueAuthorized } },
    { token: EmissionPlanService, value: emissionPlans() },
  ]);
  return { service, issued, grantChecks };
}

describe("VouchersService listings", () => {
  it("lists the vouchers of an issuer to its owner", async () => {
    const { service } = await harness();

    await expect(service.listByIssuer(OWNER_ID, ISSUER.id)).resolves.toEqual([
      expect.objectContaining({ id: "voucher-1", number: 42 }),
    ]);
  });

  it("refuses to list the vouchers of another user's issuer", async () => {
    const { service } = await harness();

    await expect(service.listByIssuer(STRANGER_ID, ISSUER.id)).rejects.toThrow(ForbiddenException);
  });

  it("lists for an api client only after checking its grant", async () => {
    const { service, grantChecks } = await harness();

    await expect(service.listForApiClient(API_CLIENT, ISSUER.id, 5)).resolves.toHaveLength(1);
    expect(grantChecks).toEqual([ISSUER.id]);
  });

  it("refuses to list for an api client without grant", async () => {
    const { service } = await harness({ grantedIssuerIds: [] });

    await expect(service.listForApiClient(API_CLIENT, ISSUER.id)).rejects.toThrow(ForbiddenException);
  });
});

describe("VouchersService documents", () => {
  it("renders the QR of an authorized voucher as a PNG", async () => {
    const { service } = await harness();

    const png = await service.buildQrPngBuffer(OWNER_ID, "voucher-1");

    expect(png.subarray(0, PNG_MAGIC.length)).toEqual(PNG_MAGIC);
  });

  it("refuses the QR of a voucher that was never authorized", async () => {
    const { service } = await harness({ vouchers: [buildVoucherDetail({ qrData: null })] });

    await expect(service.buildQrPngBuffer(OWNER_ID, "voucher-1")).rejects.toThrow(
      new NotFoundException("El comprobante no tiene QR (no autorizado)."),
    );
  });

  it("renders the PDF of an authorized voucher for its owner", async () => {
    const { service } = await harness();

    const pdf = await service.renderPdf(OWNER_ID, "voucher-1");

    expect(pdf.subarray(0, PDF_MAGIC.length).toString()).toBe(PDF_MAGIC);
  });

  it("renders the PDF for a granted api client", async () => {
    const { service } = await harness();

    const pdf = await service.renderPdfForApiClient(API_CLIENT, "voucher-1");

    expect(pdf.subarray(0, PDF_MAGIC.length).toString()).toBe(PDF_MAGIC);
  });

  it.each([
    ["without CAE", { cae: null }],
    ["without QR", { qrData: null }],
    ["with an empty CAE", { cae: "" }],
  ])("refuses the PDF of a voucher %s", async (_description, overrides) => {
    const { service } = await harness({ vouchers: [buildVoucherDetail(overrides)] });

    await expect(service.renderPdf(OWNER_ID, "voucher-1")).rejects.toThrow(
      new NotFoundException("El comprobante no está autorizado todavía (sin CAE/QR)."),
    );
  });

  it("refuses the PDF of another user's voucher", async () => {
    const { service } = await harness();

    await expect(service.renderPdf(STRANGER_ID, "voucher-1")).rejects.toThrow(ForbiddenException);
  });
});

describe("VouchersService issuing and previews", () => {
  it("issues for a granted api client with the issuer of the payload", async () => {
    const { service, issued, grantChecks } = await harness();

    await expect(service.issueForApiClient(API_CLIENT, buildInput(), "key-1")).resolves.toEqual(ISSUED);
    expect(grantChecks).toEqual([ISSUER.id]);
    expect(issued).toEqual([{ issuerId: ISSUER.id, idempotencyKey: "key-1" }]);
  });

  it("does not issue for an api client without grant", async () => {
    const { service, issued } = await harness({ grantedIssuerIds: [] });

    await expect(service.issueForApiClient(API_CLIENT, buildInput())).rejects.toThrow(ForbiddenException);
    expect(issued).toEqual([]);
  });

  it("previews the amounts for the owner and for a granted api client", async () => {
    const { service } = await harness();
    const forUser = await service.previewForUser(OWNER_ID, buildInput());
    const forApiClient = await service.previewForApiClient(API_CLIENT, buildInput());

    expect(forUser).toEqual(expect.objectContaining({ netAmount: 100, ivaAmount: 0, totalAmount: 100 }));
    expect(forApiClient).toEqual(forUser);
  });

  it("refuses a preview for another user's issuer", async () => {
    const { service } = await harness();

    await expect(service.previewForUser(STRANGER_ID, buildInput())).rejects.toThrow(ForbiddenException);
  });

  it("plans the next number from the last authorized one", async () => {
    const { service } = await harness();

    const plan = await service.computeEmissionPlanForUser(OWNER_ID, buildInput());

    expect(plan).toEqual(
      expect.objectContaining({
        salesPoint: 1,
        voucherType: 11,
        number: LAST_AUTHORIZED + 1,
        totalAmount: 100,
      }),
    );
    expect(plan.verification).toEqual(
      expect.objectContaining({
        onboardingStatus: IssuerOnboardingStatus.ISSUING_CONFIRMED,
        confirmsIssuing: true,
      }),
    );
  });

  it("plans for a granted api client and refuses one without grant", async () => {
    const granted = await harness();
    const denied = await harness({ grantedIssuerIds: [] });

    await expect(granted.service.computeEmissionPlanForApiClient(API_CLIENT, buildInput())).resolves.toEqual(
      expect.objectContaining({ number: LAST_AUTHORIZED + 1 }),
    );
    await expect(denied.service.computeEmissionPlanForApiClient(API_CLIENT, buildInput())).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe("EmissionPlanService verification", () => {
  it("does not confirm issuing while the onboarding is still pending", async () => {
    const tables: EmissionPlanTables = {
      issuer: {
        findUniqueOrThrow: () =>
          Promise.resolve({ onboardingStatus: IssuerOnboardingStatus.PENDING_DELEGATION }),
      },
    };
    const notUsed = (): Promise<never> => Promise.reject(new Error("No se usa en estos tests."));
    const plans = new EmissionPlanService(tables, fakeIssuerAuth(), fakeIssuerOnboarding(), {
      getLastAuthorized: () => Promise.resolve(0),
      requestCae: notUsed,
      queryVoucher: notUsed,
      queryVoucherDetail: notUsed,
    });

    const plan = await plans.computeEmissionPlan(ISSUER, buildInput());

    expect(plan.number).toBe(1);
    expect(plan.verification).toEqual(
      expect.objectContaining({
        onboardingStatus: IssuerOnboardingStatus.PENDING_DELEGATION,
        confirmsIssuing: false,
      }),
    );
  });
});
