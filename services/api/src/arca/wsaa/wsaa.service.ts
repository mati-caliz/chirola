import {
  Inject,
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../../prisma/prisma.service';
import { ArcaCallOutcome } from '../arca-call-log.service';
import { ARCA_CALL_RECORDER, type ArcaCallRecorder } from '../arca-soap.util';
import {
  CertificateCredentials,
  ArcaService,
  AccessTicket,
} from './wsaa.types';

const TICKET_RENEWAL_MARGIN_MS = 10 * 60_000;
const WSAA_OPERATION = 'loginCms';
const WSAA_SERVICE = 'wsaa';
const NO_HTTP_RESPONSE = 0;

@Injectable()
export class WsaaService {
  private readonly logger = new Logger(WsaaService.name);
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(ARCA_CALL_RECORDER)
    private readonly callLog: ArcaCallRecorder,
  ) {}

  private get wsaaUrl(): string {
    const env = this.config.get<string>('ARCA_ENV', 'homologacion');
    return env === 'produccion'
      ? this.config.get<string>(
          'ARCA_WSAA_URL_PROD',
          'https://wsaa.afip.gov.ar/ws/services/LoginCms',
        )
      : this.config.get<string>(
          'ARCA_WSAA_URL_HOMO',
          'https://wsaahomo.afip.gov.ar/ws/services/LoginCms',
        );
  }

  async getAccessTicket(
    issuerId: string,
    creds: CertificateCredentials,
    service: ArcaService = 'wsfe',
  ): Promise<AccessTicket> {
    const cached = await this.prisma.accessTicketCache.findUnique({
      where: { issuerId_service: { issuerId, service } },
    });

    if (
      cached &&
      cached.expiration.getTime() - Date.now() > TICKET_RENEWAL_MARGIN_MS
    ) {
      return {
        token: cached.token,
        sign: cached.sign,
        expiration: cached.expiration,
        generation: cached.generation,
      };
    }

    const accessTicket = await this.login(issuerId, creds, service);
    await this.prisma.accessTicketCache.upsert({
      where: { issuerId_service: { issuerId, service } },
      create: { issuerId, service, ...accessTicket },
      update: { ...accessTicket },
    });
    this.logger.log(
      `TA nuevo para ${issuerId}:${service}, vence ${accessTicket.expiration.toISOString()}`,
    );
    return accessTicket;
  }

  private async login(
    issuerId: string,
    creds: CertificateCredentials,
    service: ArcaService,
  ): Promise<AccessTicket> {
    const ltr = this.buildLoginTicketRequest(service);
    const cms = this.signCms(ltr, creds);
    const responseXml = await this.callLoginCms(issuerId, cms);
    return this.parseLoginResponse(responseXml);
  }

  private buildLoginTicketRequest(service: ArcaService): string {
    const now = Date.now();
    const uniqueId = Math.floor(now / 1000);
    const gen = new Date(now - 10 * 60_000);
    const exp = new Date(now + 10 * 60_000);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<loginTicketRequest version="1.0">',
      '<header>',
      `<uniqueId>${uniqueId}</uniqueId>`,
      `<generationTime>${gen.toISOString()}</generationTime>`,
      `<expirationTime>${exp.toISOString()}</expirationTime>`,
      '</header>',
      `<service>${service}</service>`,
      '</loginTicketRequest>',
    ].join('');
  }

  private signCms(ltr: string, creds: CertificateCredentials): string {
    try {
      const cert = forge.pki.certificateFromPem(creds.certPem);
      const privateKey = forge.pki.privateKeyFromPem(creds.privateKeyPem);

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(ltr, 'utf8');
      p7.addCertificate(cert);
      p7.addSigner({
        key: privateKey,
        certificate: cert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
          { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
          { type: forge.pki.oids.messageDigest },
          { type: forge.pki.oids.signingTime, value: new Date().toString() },
        ],
      });
      p7.sign();

      const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
      return forge.util.encode64(der);
    } catch (err) {
      this.logger.error('Error firmando CMS', err as Error);
      throw new InternalServerErrorException(
        'No se pudo firmar el pedido de autenticación (CMS).',
      );
    }
  }

  private async callLoginCms(
    issuerId: string,
    cmsBase64: string,
  ): Promise<string> {
    const envelope = [
      '<soapenv:Envelope',
      ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
      ' xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">',
      '<soapenv:Header/>',
      '<soapenv:Body>',
      '<wsaa:loginCms>',
      `<wsaa:in0>${cmsBase64}</wsaa:in0>`,
      '</wsaa:loginCms>',
      '</soapenv:Body>',
      '</soapenv:Envelope>',
    ].join('');

    const startedAt = Date.now();
    const record = (
      outcome: (typeof ArcaCallOutcome)[keyof typeof ArcaCallOutcome],
      httpStatus: number,
      responseXml: string,
    ): Promise<void> =>
      this.callLog.record({
        issuerId,
        service: WSAA_SERVICE,
        operation: WSAA_OPERATION,
        httpStatus,
        durationMs: Date.now() - startedAt,
        outcome,
        requestXml: envelope,
        responseXml,
      });

    let res: Response;
    try {
      res = await fetch(this.wsaaUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '',
        },
        body: envelope,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await record(ArcaCallOutcome.NETWORK_ERROR, NO_HTTP_RESPONSE, message);
      throw err;
    }

    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`WSAA respondió ${res.status}: ${text}`);
      await record(ArcaCallOutcome.FAULT, res.status, text);
      throw new InternalServerErrorException(
        `WSAA devolvió error HTTP ${res.status}.`,
      );
    }
    await record(ArcaCallOutcome.SUCCESS, res.status, text);
    return text;
  }

  private parseLoginResponse(soapXml: string): AccessTicket {
    const soap = this.parser.parse(soapXml) as Record<string, unknown>;
    const loginReturn = this.deepFind(soap, 'loginCmsReturn');
    if (typeof loginReturn !== 'string') {

      const fault = this.deepFind(soap, 'faultstring');
      throw new InternalServerErrorException(
        `WSAA no devolvió un TA${fault ? `: ${String(fault)}` : ''}.`,
      );
    }

    const inner = this.parser.parse(loginReturn) as Record<string, unknown>;
    const token = this.deepFind(inner, 'token');
    const sign = this.deepFind(inner, 'sign');
    const expiration = this.deepFind(inner, 'expirationTime');
    const generation = this.deepFind(inner, 'generationTime');

    if (typeof token !== 'string' || typeof sign !== 'string') {
      throw new InternalServerErrorException(
        'No se pudieron extraer token/sign de la respuesta de WSAA.',
      );
    }

    return {
      token,
      sign,
      expiration: new Date(String(expiration)),
      generation: new Date(String(generation)),
    };
  }

  private deepFind(obj: unknown, key: string): unknown {
    if (obj == null || typeof obj !== 'object') return undefined;
    if (key in (obj as Record<string, unknown>)) {
      return (obj as Record<string, unknown>)[key];
    }
    for (const value of Object.values(obj as Record<string, unknown>)) {
      const found = this.deepFind(value, key);
      if (found !== undefined) return found;
    }
    return undefined;
  }
}
