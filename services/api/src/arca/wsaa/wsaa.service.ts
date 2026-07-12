import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as forge from 'node-forge';
import { XMLParser } from 'fast-xml-parser';
import {
  CredencialesCert,
  ServicioArca,
  TicketAcceso,
} from './wsaa.types';

/**
 * Cliente self-host de WSAA (Web Service de Autenticación y Autorización de ARCA).
 *
 * Flujo:
 *  1. Arma el Login Ticket Request (LTR) en XML.
 *  2. Lo firma como CMS/PKCS#7 con el cert + clave privada del contribuyente.
 *  3. Llama a loginCms y obtiene el Ticket de Acceso (token + sign, ~12h).
 *
 * REGLA DE ORO: se cachea el TA por (cuit, servicio) hasta su vencimiento.
 * Pedir un TA nuevo teniendo uno vigente hace que ARCA bloquee temporalmente.
 */
@Injectable()
export class WsaaService {
  private readonly logger = new Logger(WsaaService.name);
  private readonly cache = new Map<string, TicketAcceso>();
  private readonly parser = new XMLParser({ ignoreAttributes: false });

  constructor(private readonly config: ConfigService) {}

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

  /**
   * Devuelve un TA vigente para (cuit, servicio), reusando el cache si sigue vivo.
   * @param cuit CUIT del contribuyente (para la clave de cache).
   */
  async getTicketAcceso(
    cuit: string,
    creds: CredencialesCert,
    servicio: ServicioArca = 'wsfe',
  ): Promise<TicketAcceso> {
    const key = `${cuit}:${servicio}`;
    const cached = this.cache.get(key);
    // Margen de 10 min para no usar un TA a punto de vencer.
    if (cached && cached.expiration.getTime() - Date.now() > 10 * 60_000) {
      return cached;
    }

    const ta = await this.login(creds, servicio);
    this.cache.set(key, ta);
    this.logger.log(
      `TA nuevo para ${key}, vence ${ta.expiration.toISOString()}`,
    );
    return ta;
  }

  /** Ejecuta el login completo contra WSAA (sin cache). */
  private async login(
    creds: CredencialesCert,
    servicio: ServicioArca,
  ): Promise<TicketAcceso> {
    const ltr = this.buildLoginTicketRequest(servicio);
    const cms = this.signCms(ltr, creds);
    const responseXml = await this.callLoginCms(cms);
    return this.parseLoginResponse(responseXml);
  }

  /** Arma el XML del Login Ticket Request. */
  private buildLoginTicketRequest(servicio: ServicioArca): string {
    const now = Date.now();
    const uniqueId = Math.floor(now / 1000);
    const gen = new Date(now - 10 * 60_000); // -10 min
    const exp = new Date(now + 10 * 60_000); // +10 min
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<loginTicketRequest version="1.0">',
      '<header>',
      `<uniqueId>${uniqueId}</uniqueId>`,
      `<generationTime>${gen.toISOString()}</generationTime>`,
      `<expirationTime>${exp.toISOString()}</expirationTime>`,
      '</header>',
      `<service>${servicio}</service>`,
      '</loginTicketRequest>',
    ].join('');
  }

  /** Firma el LTR como CMS/PKCS#7 (DER en base64), como exige WSAA. */
  private signCms(ltr: string, creds: CredencialesCert): string {
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

  /** POST del SOAP loginCms al endpoint de WSAA. */
  private async callLoginCms(cmsBase64: string): Promise<string> {
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

    const res = await fetch(this.wsaaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: '',
      },
      body: envelope,
    });

    const text = await res.text();
    if (!res.ok) {
      this.logger.error(`WSAA respondió ${res.status}: ${text}`);
      throw new InternalServerErrorException(
        `WSAA devolvió error HTTP ${res.status}.`,
      );
    }
    return text;
  }

  /** Extrae token, sign y vencimiento de la respuesta de loginCms. */
  private parseLoginResponse(soapXml: string): TicketAcceso {
    const soap = this.parser.parse(soapXml) as Record<string, unknown>;
    const loginReturn = this.deepFind(soap, 'loginCmsReturn');
    if (typeof loginReturn !== 'string') {
      // Puede venir un soap:Fault
      const fault = this.deepFind(soap, 'faultstring');
      throw new InternalServerErrorException(
        `WSAA no devolvió un TA${fault ? `: ${String(fault)}` : ''}.`,
      );
    }

    // loginCmsReturn es un XML (loginTicketResponse) embebido.
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

  /** Busca recursivamente la primera aparición de una clave en un objeto parseado. */
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
