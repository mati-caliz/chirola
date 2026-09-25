import { Inject, Injectable, Logger, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as forge from "node-forge";
import { PrismaService } from "../../prisma/prisma.service";
import { isProduction } from "../arca-environment";
import { ArcaCallOutcome } from "../arca-call-log.service";
import { ARCA_CALL_RECORDER, type ArcaCallRecorder } from "../arca-soap.util";
import { findByTag, parseXml, xmlText } from "../arca-xml";
import { wsaaFaultMessage } from "./wsaa-fault";
import { AccessTicketRequest, CertificateCredentials, ArcaService, AccessTicket } from "./wsaa.types";

const TICKET_RENEWAL_MARGIN_MS = 10 * 60_000;
const WSAA_OPERATION = "loginCms";
const WSAA_SERVICE = "wsaa";
const NO_HTTP_RESPONSE = 0;
const MILLISECONDS_PER_SECOND = 1000;
const LOGIN_TICKET_CLOCK_SKEW_MS = 10 * 60_000;

function requiredOid(name: string): string {
  const oid = forge.pki.oids[name];
  if (oid === undefined) {
    throw new Error(`node-forge no conoce el OID ${name}.`);
  }
  return oid;
}

function faultSuffix(fault: unknown): string {
  const hasFault = Boolean(fault);
  return hasFault ? `: ${xmlText(fault)}` : "";
}

@Injectable()
export class WsaaService {
  private readonly logger = new Logger(WsaaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(ARCA_CALL_RECORDER)
    private readonly callLog: ArcaCallRecorder,
  ) {}

  private wsaaUrl(environment: string): string {
    return isProduction(environment)
      ? this.config.get<string>("ARCA_WSAA_URL_PROD", "https://wsaa.afip.gov.ar/ws/services/LoginCms")
      : this.config.get<string>("ARCA_WSAA_URL_HOMO", "https://wsaahomo.afip.gov.ar/ws/services/LoginCms");
  }

  async getAccessTicket(request: AccessTicketRequest): Promise<AccessTicket> {
    const { issuerId, holderCuit, environment, credentials, service } = request;
    const cacheKey = { holderCuit, environment, service };
    const cached = await this.prisma.accessTicketCache.findUnique({
      where: { holderCuit_environment_service: cacheKey },
    });

    if (cached && cached.expiration.getTime() - Date.now() > TICKET_RENEWAL_MARGIN_MS) {
      return {
        token: cached.token,
        sign: cached.sign,
        expiration: cached.expiration,
        generation: cached.generation,
      };
    }

    const accessTicket = await this.login(issuerId, credentials, service, environment);
    await this.prisma.accessTicketCache.upsert({
      where: { holderCuit_environment_service: cacheKey },
      create: { ...cacheKey, ...accessTicket },
      update: { ...accessTicket },
    });
    this.logger.log(
      `TA nuevo para ${holderCuit}:${environment}:${service}, vence ${accessTicket.expiration.toISOString()}`,
    );
    return accessTicket;
  }

  private async login(
    issuerId: string,
    creds: CertificateCredentials,
    service: ArcaService,
    environment: string,
  ): Promise<AccessTicket> {
    const ltr = this.buildLoginTicketRequest(service);
    const cms = this.signCms(ltr, creds);
    const responseXml = await this.callLoginCms(issuerId, cms, environment);
    return this.parseLoginResponse(responseXml);
  }

  private buildLoginTicketRequest(service: ArcaService): string {
    const now = Date.now();
    const uniqueId = Math.floor(now / MILLISECONDS_PER_SECOND);
    const gen = new Date(now - LOGIN_TICKET_CLOCK_SKEW_MS);
    const exp = new Date(now + LOGIN_TICKET_CLOCK_SKEW_MS);
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<loginTicketRequest version="1.0">',
      "<header>",
      `<uniqueId>${uniqueId}</uniqueId>`,
      `<generationTime>${gen.toISOString()}</generationTime>`,
      `<expirationTime>${exp.toISOString()}</expirationTime>`,
      "</header>",
      `<service>${service}</service>`,
      "</loginTicketRequest>",
    ].join("");
  }

  private signCms(ltr: string, creds: CertificateCredentials): string {
    try {
      const cert = forge.pki.certificateFromPem(creds.certPem);
      const privateKey = forge.pki.privateKeyFromPem(creds.privateKeyPem);

      const p7 = forge.pkcs7.createSignedData();
      p7.content = forge.util.createBuffer(ltr, "utf8");
      p7.addCertificate(cert);
      p7.addSigner({
        key: privateKey,
        certificate: cert,
        digestAlgorithm: requiredOid("sha256"),
        authenticatedAttributes: [
          { type: requiredOid("contentType"), value: requiredOid("data") },
          { type: requiredOid("messageDigest") },
          { type: requiredOid("signingTime"), value: new Date().toString() },
        ],
      });
      p7.sign();

      const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
      return forge.util.encode64(der);
    } catch (err) {
      this.logger.error("Error firmando CMS", err);
      throw new InternalServerErrorException("No se pudo firmar el pedido de autenticación (CMS).");
    }
  }

  private async callLoginCms(issuerId: string, cmsBase64: string, environment: string): Promise<string> {
    const envelope = [
      "<soapenv:Envelope",
      ' xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"',
      ' xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">',
      "<soapenv:Header/>",
      "<soapenv:Body>",
      "<wsaa:loginCms>",
      `<wsaa:in0>${cmsBase64}</wsaa:in0>`,
      "</wsaa:loginCms>",
      "</soapenv:Body>",
      "</soapenv:Envelope>",
    ].join("");

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
      res = await fetch(this.wsaaUrl(environment), {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: "",
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
      throw new InternalServerErrorException(wsaaFaultMessage(text, res.status));
    }
    await record(ArcaCallOutcome.SUCCESS, res.status, text);
    return text;
  }

  private parseLoginResponse(soapXml: string): AccessTicket {
    const soap = parseXml(soapXml);
    const loginReturn = findByTag(soap, "loginCmsReturn");
    if (typeof loginReturn !== "string") {
      const fault = findByTag(soap, "faultstring");
      throw new InternalServerErrorException(`WSAA no devolvió un TA${faultSuffix(fault)}.`);
    }

    const inner = parseXml(loginReturn);
    const token = findByTag(inner, "token");
    const sign = findByTag(inner, "sign");
    const expiration = findByTag(inner, "expirationTime");
    const generation = findByTag(inner, "generationTime");

    if (typeof token !== "string" || typeof sign !== "string") {
      throw new InternalServerErrorException("No se pudieron extraer token/sign de la respuesta de WSAA.");
    }

    return {
      token,
      sign,
      expiration: new Date(String(expiration)),
      generation: new Date(String(generation)),
    };
  }
}
