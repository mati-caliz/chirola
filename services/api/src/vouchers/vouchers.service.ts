import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  defaultRecipientIvaCondition,
  type IssueVoucher,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import { calculateAmounts } from '../arca/wsfe/iva-calculator';
import { buildQrUrl } from './qr.util';
import { renderQrPng, recipientFromQr } from './qr-image.util';
import { renderVoucherPdf } from './pdf.util';

export interface IssuedVoucher {
  id: string;
  voucherType: number;
  salesPoint: number;
  number: number;
  cae: string;
  caeExpiration: Date;
  netAmount: number;
  ivaAmount: number;
  totalAmount: number;
  qrData: string;
}

@Injectable()
export class VouchersService {
  private readonly logger = new Logger(VouchersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
  ) {}

  async get(userId: string, id: string) {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
      include: { items: true, client: true, salesPoint: true, issuer: true },
    });
    if (!voucher) {
      throw new NotFoundException('Comprobante inexistente.');
    }
    if (voucher.issuer.userId !== userId) {
      throw new ForbiddenException('El comprobante no pertenece al usuario.');
    }
    return voucher;
  }

  async buildQrPngBuffer(userId: string, id: string): Promise<Buffer> {
    const voucher = await this.get(userId, id);
    if (!voucher.qrData) {
      throw new NotFoundException('El comprobante no tiene QR (no autorizado).');
    }
    return renderQrPng(voucher.qrData);
  }

  async renderPdf(userId: string, id: string): Promise<Buffer> {
    const voucher = await this.get(userId, id);
    if (!voucher.qrData || !voucher.cae) {
      throw new NotFoundException(
        'El comprobante no está autorizado todavía (sin CAE/QR).',
      );
    }
    const qrPng = await renderQrPng(voucher.qrData);
    return renderVoucherPdf({
      issuer: {
        legalName: voucher.issuer.legalName,
        cuit: voucher.issuer.cuit,
        ivaCondition: voucher.issuer.ivaCondition,
      },
      recipient: recipientFromQr(voucher.qrData),
      voucherType: voucher.voucherType,
      salesPoint: voucher.salesPoint.number,
      number: voucher.number,
      date: voucher.voucherDate,
      currency: voucher.currency,
      netAmount: Number(voucher.netAmount),
      ivaAmount: Number(voucher.ivaAmount),
      totalAmount: Number(voucher.totalAmount),
      cae: voucher.cae,
      caeExpiration: voucher.caeExpiration ?? voucher.voucherDate,
      items: voucher.items.map((it) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        ivaRate: Number(it.ivaRate),
        subtotal: Number(it.subtotal),
      })),
      associatedVouchers: Array.isArray(voucher.associatedVouchers)
        ? (voucher.associatedVouchers as unknown as {
            type: number;
            salesPoint: number;
            number: number;
          }[])
        : [],
      qrPng,
    });
  }

  async issue(
    userId: string,
    input: IssueVoucher,
  ): Promise<IssuedVoucher> {
    const issuer = await this.prisma.issuer.findUnique({
      where: { id: input.issuerId },
    });
    if (!issuer) {
      throw new NotFoundException('Emisor inexistente.');
    }
    if (issuer.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }

    const credentials = await this.certs.getCredentials(issuer.id);
    const accessTicket = await this.wsaa.getAccessTicket(issuer.cuit, credentials, 'wsfe');
    const auth = { cuit: issuer.cuit, token: accessTicket.token, sign: accessTicket.sign };

    const last = await this.wsfe.getLastAuthorized(
      auth,
      input.salesPoint,
      input.voucherType,
    );
    const number = last + 1;

    const amounts = calculateAmounts(input.voucherType, input.items);
    const date = new Date();
    const ivaConditionId =
      input.recipient.ivaConditionId ??
      defaultRecipientIvaCondition(input.voucherType);

    const cae = await this.wsfe.requestCae(auth, {
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      concept: input.concept,
      number,
      date,
      recipient: {
        docType: input.recipient.docType,
        docNumber: input.recipient.docNumber,
        ivaConditionId,
      },
      amounts,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      associatedVouchers: input.associatedVouchers,
    });

    const qrData = buildQrUrl({
      date,
      issuerCuit: issuer.cuit,
      salesPoint: input.salesPoint,
      voucherType: input.voucherType,
      number,
      totalAmount: amounts.totalAmount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      recipientDocType: input.recipient.docType,
      recipientDocNumber: input.recipient.docNumber,
      cae: cae.cae,
    });

    const salesPoint = await this.prisma.salesPoint.upsert({
      where: { issuerId_number: { issuerId: issuer.id, number: input.salesPoint } },
      create: { issuerId: issuer.id, number: input.salesPoint },
      update: {},
    });

    const voucher = await this.prisma.voucher.create({
      data: {
        issuerId: issuer.id,
        salesPointId: salesPoint.id,
        voucherType: input.voucherType,
        number,
        voucherDate: date,
        concept: input.concept,
        netAmount: amounts.netAmount,
        ivaAmount: amounts.ivaAmount,
        totalAmount: amounts.totalAmount,
        currency: input.currency,
        exchangeRate: input.exchangeRate,
        status: 'AUTORIZADO',
        cae: cae.cae,
        caeExpiration: cae.caeVto,
        qrData,
        associatedVouchers: input.associatedVouchers ?? undefined,
        items: {
          create: input.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            ivaRate: it.ivaRate,
            subtotal: Math.round(it.quantity * it.unitPrice * 100) / 100,
          })),
        },
      },
    });

    this.logger.log(
      `Comprobante ${input.voucherType}-${input.salesPoint}-${number} emitido, CAE ${cae.cae}`,
    );

    return {
      id: voucher.id,
      voucherType: input.voucherType,
      salesPoint: input.salesPoint,
      number,
      cae: cae.cae,
      caeExpiration: cae.caeVto,
      netAmount: amounts.netAmount,
      ivaAmount: amounts.ivaAmount,
      totalAmount: amounts.totalAmount,
      qrData,
    };
  }
}
