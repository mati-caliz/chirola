import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  condicionIvaReceptorPorDefecto,
  type EmitirComprobante,
} from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CertsService } from '../certs/certs.service';
import { WsaaService } from '../arca/wsaa/wsaa.service';
import { WsfeService } from '../arca/wsfe/wsfe.service';
import { calcularImportes } from '../arca/wsfe/iva-calculator';
import { buildQrUrl } from './qr.util';
import { renderQrPng, receptorDesdeQr } from './qr-image.util';
import { renderComprobantePdf } from './pdf.util';

export interface ComprobanteEmitido {
  id: string;
  tipoCbte: number;
  puntoVenta: number;
  numero: number;
  cae: string;
  caeVto: Date;
  impNeto: number;
  impIva: number;
  impTotal: number;
  qrData: string;
}

@Injectable()
export class ComprobantesService {
  private readonly logger = new Logger(ComprobantesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly certs: CertsService,
    private readonly wsaa: WsaaService,
    private readonly wsfe: WsfeService,
  ) {}

  async obtener(userId: string, id: string) {
    const comprobante = await this.prisma.comprobante.findUnique({
      where: { id },
      include: { items: true, cliente: true, puntoVenta: true, emisor: true },
    });
    if (!comprobante) {
      throw new NotFoundException('Comprobante inexistente.');
    }
    if (comprobante.emisor.userId !== userId) {
      throw new ForbiddenException('El comprobante no pertenece al usuario.');
    }
    return comprobante;
  }

  async renderQrPng(userId: string, id: string): Promise<Buffer> {
    const comprobante = await this.obtener(userId, id);
    if (!comprobante.qrData) {
      throw new NotFoundException('El comprobante no tiene QR (no autorizado).');
    }
    return renderQrPng(comprobante.qrData);
  }

  async renderPdf(userId: string, id: string): Promise<Buffer> {
    const c = await this.obtener(userId, id);
    if (!c.qrData || !c.cae) {
      throw new NotFoundException(
        'El comprobante no está autorizado todavía (sin CAE/QR).',
      );
    }
    const qrPng = await renderQrPng(c.qrData);
    return renderComprobantePdf({
      emisor: {
        razonSocial: c.emisor.razonSocial,
        cuit: c.emisor.cuit,
        condicionIva: c.emisor.condicionIva,
      },
      receptor: receptorDesdeQr(c.qrData),
      tipoCbte: c.tipoCbte,
      puntoVenta: c.puntoVenta.numero,
      numero: c.numero,
      fecha: c.fechaCbte,
      moneda: c.moneda,
      impNeto: Number(c.impNeto),
      impIva: Number(c.impIva),
      impTotal: Number(c.impTotal),
      cae: c.cae,
      caeVto: c.caeVto ?? c.fechaCbte,
      items: c.items.map((it) => ({
        descripcion: it.descripcion,
        cantidad: Number(it.cantidad),
        precioUnit: Number(it.precioUnit),
        alicuotaIva: Number(it.alicuotaIva),
        subtotal: Number(it.subtotal),
      })),
      comprobantesAsociados: Array.isArray(c.comprobantesAsoc)
        ? (c.comprobantesAsoc as unknown as {
            tipo: number;
            puntoVenta: number;
            numero: number;
          }[])
        : [],
      qrPng,
    });
  }

  async emitir(
    userId: string,
    input: EmitirComprobante,
  ): Promise<ComprobanteEmitido> {
    const emisor = await this.prisma.emisor.findUnique({
      where: { id: input.emisorId },
    });
    if (!emisor) {
      throw new NotFoundException('Emisor inexistente.');
    }
    if (emisor.userId !== userId) {
      throw new ForbiddenException('El emisor no pertenece al usuario.');
    }

    const creds = await this.certs.getCredenciales(emisor.id);
    const ta = await this.wsaa.getTicketAcceso(emisor.cuit, creds, 'wsfe');
    const auth = { cuit: emisor.cuit, token: ta.token, sign: ta.sign };

    const ultimo = await this.wsfe.getUltimoAutorizado(
      auth,
      input.puntoVenta,
      input.tipoCbte,
    );
    const numero = ultimo + 1;

    const importes = calcularImportes(input.tipoCbte, input.items);
    const fecha = new Date();
    const condicionIvaId =
      input.receptor.condicionIvaId ??
      condicionIvaReceptorPorDefecto(input.tipoCbte);

    const cae = await this.wsfe.solicitarCae(auth, {
      puntoVenta: input.puntoVenta,
      tipoCbte: input.tipoCbte,
      concepto: input.concepto,
      numero,
      fecha,
      receptor: {
        tipoDoc: input.receptor.tipoDoc,
        numeroDoc: input.receptor.numeroDoc,
        condicionIvaId,
      },
      importes,
      moneda: input.moneda,
      cotizacion: input.cotizacion,
      comprobantesAsociados: input.comprobantesAsociados,
    });

    const qrData = buildQrUrl({
      fecha,
      cuitEmisor: emisor.cuit,
      puntoVenta: input.puntoVenta,
      tipoCbte: input.tipoCbte,
      numero,
      importeTotal: importes.impTotal,
      moneda: input.moneda,
      cotizacion: input.cotizacion,
      tipoDocReceptor: input.receptor.tipoDoc,
      nroDocReceptor: input.receptor.numeroDoc,
      cae: cae.cae,
    });

    const puntoVenta = await this.prisma.puntoVenta.upsert({
      where: { emisorId_numero: { emisorId: emisor.id, numero: input.puntoVenta } },
      create: { emisorId: emisor.id, numero: input.puntoVenta },
      update: {},
    });

    const comprobante = await this.prisma.comprobante.create({
      data: {
        emisorId: emisor.id,
        puntoVentaId: puntoVenta.id,
        tipoCbte: input.tipoCbte,
        numero,
        fechaCbte: fecha,
        concepto: input.concepto,
        impNeto: importes.impNeto,
        impIva: importes.impIva,
        impTotal: importes.impTotal,
        moneda: input.moneda,
        cotizacion: input.cotizacion,
        estado: 'AUTORIZADO',
        cae: cae.cae,
        caeVto: cae.caeVto,
        qrData,
        comprobantesAsoc: input.comprobantesAsociados ?? undefined,
        items: {
          create: input.items.map((it) => ({
            descripcion: it.descripcion,
            cantidad: it.cantidad,
            precioUnit: it.precioUnit,
            alicuotaIva: it.alicuotaIva,
            subtotal: Math.round(it.cantidad * it.precioUnit * 100) / 100,
          })),
        },
      },
    });

    this.logger.log(
      `Comprobante ${input.tipoCbte}-${input.puntoVenta}-${numero} emitido, CAE ${cae.cae}`,
    );

    return {
      id: comprobante.id,
      tipoCbte: input.tipoCbte,
      puntoVenta: input.puntoVenta,
      numero,
      cae: cae.cae,
      caeVto: cae.caeVto,
      impNeto: importes.impNeto,
      impIva: importes.impIva,
      impTotal: importes.impTotal,
      qrData,
    };
  }
}
