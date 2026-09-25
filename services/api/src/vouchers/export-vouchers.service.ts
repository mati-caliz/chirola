import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  exportItemTotal,
  exportVoucherTotal,
  TaxTreatment,
  VoucherStatus,
  type IssueExportVoucher,
} from "@chirola/shared";
import { IssuerAuthService } from "../issuer-arca/issuer-auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { WsfexService } from "../arca/wsfex/wsfex.service";
import type { Prisma } from "@prisma/client";
import type { ExportCaeRequest, ExportCaeResult } from "../arca/wsfex/wsfex.types";
import { buildQrUrl } from "./qr.util";
import { IssuerLockService } from "./issuer-lock.service";

const EXPORT_SERVICE = "wsfex";
const NO_IVA_RATE = 0;
const FOREIGN_RECIPIENT_DOC_TYPE = 80;
const EXPORT_CONCEPT = 1;

export type ExportedVoucher = Prisma.VoucherGetPayload<{ include: { items: true; salesPoint: true } }>;

interface ExportEmission {
  issuer: { id: string; cuit: string };
  input: IssueExportVoucher;
  request: ExportCaeRequest;
  cae: ExportCaeResult;
  totalAmount: number;
}

function optionalExportJson({
  input,
  cae,
}: ExportEmission): Pick<Prisma.VoucherUncheckedCreateInput, "arcaObservations" | "associatedVouchers"> {
  const { associatedVouchers } = input;
  const hasAssociatedVouchers = associatedVouchers !== undefined && associatedVouchers.length > 0;
  return {
    ...(cae.observations.length > 0
      ? { arcaObservations: cae.observations.map((observation) => ({ ...observation })) }
      : {}),
    ...(hasAssociatedVouchers ? { associatedVouchers } : {}),
  };
}

@Injectable()
export class ExportVouchersService {
  private readonly logger = new Logger(ExportVouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly issuerAuth: IssuerAuthService,
    private readonly wsfex: WsfexService,
    private readonly issuerLock: IssuerLockService,
  ) {}

  async issue(userId: string, input: IssueExportVoucher): Promise<ExportedVoucher> {
    const issuer = await this.prisma.issuer.findFirst({
      where: { id: input.issuerId, userId },
    });
    if (!issuer) {
      throw new NotFoundException("Emisor inexistente.");
    }

    return await this.issuerLock.runExclusive(issuer.id, async () => {
      const auth = await this.issuerAuth.buildAuth(issuer, EXPORT_SERVICE);
      const [lastNumber, lastRequestId] = await Promise.all([
        this.wsfex.getLastAuthorized(auth, input.salesPoint, input.voucherType),
        this.wsfex.getLastRequestId(auth),
      ]);

      const totalAmount = exportVoucherTotal(input.items);
      const date = new Date();
      const request: ExportCaeRequest = {
        requestId: lastRequestId + 1,
        salesPoint: input.salesPoint,
        voucherType: input.voucherType,
        number: lastNumber + 1,
        date,
        exportType: input.exportType,
        destinationCountryId: input.destinationCountryId,
        countryTaxId: input.countryTaxId,
        client: input.client,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        language: input.language,
        incoterm: input.incoterm,
        incotermDescription: input.incotermDescription,
        paymentMethod: input.paymentMethod,
        commercialNotes: input.commercialNotes,
        notes: input.notes,
        shippingPermits: input.shippingPermits ?? [],
        items: input.items,
        totalAmount,
        associatedVouchers: input.associatedVouchers ?? [],
      };

      const cae = await this.wsfex.authorize(auth, request);
      this.logger.log(
        `Comprobante de exportación ${input.voucherType}-${input.salesPoint}-${request.number} emitido, CAE ${cae.cae}`,
      );

      return await this.persist({ issuer, input, request, cae, totalAmount });
    });
  }

  private async persist(emission: ExportEmission): Promise<ExportedVoucher> {
    const { issuer, input, request, cae, totalAmount } = emission;
    const issuerId = issuer.id;
    const qrData = buildQrUrl({
      date: request.date,
      issuerCuit: issuer.cuit,
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      number: request.number,
      totalAmount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      recipientDocType: FOREIGN_RECIPIENT_DOC_TYPE,
      recipientDocNumber: input.countryTaxId,
      cae: cae.cae,
    });

    const salesPoint = await this.prisma.salesPoint.upsert({
      where: { issuerId_number: { issuerId, number: input.salesPoint } },
      create: { issuerId, number: input.salesPoint },
      update: {},
    });

    return await this.prisma.voucher.create({
      data: {
        issuerId,
        salesPointId: salesPoint.id,
        recipientDocType: FOREIGN_RECIPIENT_DOC_TYPE,
        recipientDocNumber: input.countryTaxId,
        recipientName: input.client.legalName,
        voucherType: input.voucherType,
        number: request.number,
        voucherDate: request.date,
        concept: EXPORT_CONCEPT,
        netAmount: 0,
        ivaAmount: 0,
        exemptAmount: totalAmount,
        untaxedAmount: 0,
        tributeAmount: 0,
        totalAmount,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        status: cae.observations.length > 0 ? VoucherStatus.OBSERVED : VoucherStatus.APPROVED,
        cae: cae.cae,
        caeExpiration: cae.caeVto,
        qrData,
        ...optionalExportJson(emission),
        exportDetail: {
          exportType: input.exportType,
          destinationCountryId: input.destinationCountryId,
          countryTaxId: input.countryTaxId,
          clientLegalName: input.client.legalName,
          clientAddress: input.client.address,
          clientTaxId: input.client.taxId ?? null,
          language: input.language,
          incoterm: input.incoterm ?? null,
          paymentMethod: input.paymentMethod ?? null,
          shippingPermits: input.shippingPermits ?? [],
          requestId: request.requestId,
        },
        items: {
          create: input.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            ivaRate: NO_IVA_RATE,
            subtotal: exportItemTotal(item),
            taxTreatment: TaxTreatment.EXEMPT,
          })),
        },
      },
      include: { items: true, salesPoint: true },
    });
  }
}
