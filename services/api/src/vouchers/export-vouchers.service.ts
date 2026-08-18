import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  exportItemTotal,
  exportVoucherTotal,
  TaxTreatment,
  VoucherStatus,
  type IssueExportVoucher,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfexService } from '../arca/wsfex/wsfex.service';
import type { ArcaIssuer } from '../arca/arca-environment';
import type { AuthContext } from '../arca/wsfe/wsfe.types';
import type { ExportCaeRequest } from '../arca/wsfex/wsfex.types';
import { buildQrUrl } from './qr.util';
import { IssuerLockService } from './issuer-lock.service';

const EXPORT_SERVICE = 'wsfex';
const NO_IVA_RATE = 0;
const FOREIGN_RECIPIENT_DOC_TYPE = 80;
const EXPORT_CONCEPT = 1;

@Injectable()
export class ExportVouchersService {
  private readonly logger = new Logger(ExportVouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfex: WsfexService,
    private readonly issuerLock: IssuerLockService,
  ) {}

  async issue(userId: string, input: IssueExportVoucher) {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    if (issuer.userId !== userId) {
      throw new NotFoundException('Emisor inexistente.');
    }

    return this.issuerLock.runExclusive(issuer.id, async () => {
      const auth = await this.buildAuth(issuer);
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

      return this.persist(issuer.id, issuer.cuit, input, request, cae, totalAmount);
    });
  }

  private async persist(
    issuerId: string,
    issuerCuit: string,
    input: IssueExportVoucher,
    request: ExportCaeRequest,
    cae: { cae: string; caeVto: Date; observations: unknown[] },
    totalAmount: number,
  ) {
    const qrData = buildQrUrl({
      date: request.date,
      issuerCuit,
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

    return this.prisma.voucher.create({
      data: {
        issuerId,
        salesPointId: salesPoint.id,
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
        status:
          cae.observations.length > 0
            ? VoucherStatus.OBSERVED
            : VoucherStatus.APPROVED,
        cae: cae.cae,
        caeExpiration: cae.caeVto,
        arcaObservations:
          cae.observations.length > 0
            ? (cae.observations as { code: string; message: string }[])
            : undefined,
        qrData,
        associatedVouchers:
          input.associatedVouchers && input.associatedVouchers.length > 0
            ? input.associatedVouchers
            : undefined,
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

  private async buildAuth(issuer: ArcaIssuer): Promise<AuthContext> {
    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(
      issuer.id,
      credentials,
      issuer.environment,
      EXPORT_SERVICE,
    );
    return {
      issuerId: issuer.id,
      cuit: issuer.cuit,
      token: accessTicket.token,
      sign: accessTicket.sign,
      environment: issuer.environment,
    };
  }
}
