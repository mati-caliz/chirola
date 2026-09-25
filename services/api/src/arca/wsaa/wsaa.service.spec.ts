import { ConfigService } from "@nestjs/config";
import * as forge from "node-forge";
import { prismaDouble } from "../../prisma/prisma.fixture";
import { RecordedArcaCalls } from "../arca-call-recorder.fixture";
import { ArcaCallOutcome } from "../arca-call-log.service";
import { escapeXml } from "../arca-soap.util";
import { stubFetchResponse } from "../fetch.fixture";
import { WsaaService } from "./wsaa.service";
import type { AccessTicketRequest, CertificateCredentials } from "./wsaa.types";

const TEST_KEY_BITS = 512;
const CERTIFICATE_VALIDITY_MS = 86_400_000;

function selfSignedCredentials(): CertificateCredentials {
  const keys = forge.pki.rsa.generateKeyPair({ bits: TEST_KEY_BITS });
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + CERTIFICATE_VALIDITY_MS);
  const subject = [{ name: "commonName", value: "chirola-test" }];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return {
    certPem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    holderCuit: null,
  };
}

const credentials = selfSignedCredentials();

function ticketRequest(): AccessTicketRequest {
  return {
    issuerId: "issuer-1",
    holderCuit: "20111111112",
    environment: "homologacion",
    credentials,
    service: "wsfe",
  };
}

function build() {
  const cachedTickets: { token: string }[] = [];
  const recorder = new RecordedArcaCalls();
  const prisma = prismaDouble({
    accessTicketCache: {
      findUnique: () => Promise.resolve(null),
      upsert: ({ create }: { create: { token: string } }) => {
        cachedTickets.push(create);
        return Promise.resolve(create);
      },
    },
  });
  return { service: new WsaaService(new ConfigService(), prisma, recorder), cachedTickets, recorder };
}

function loginResponse(innerXml: string): string {
  return (
    "<soapenv:Envelope><soapenv:Body><loginCmsResponse>" +
    `<loginCmsReturn>${escapeXml(innerXml)}</loginCmsReturn>` +
    "</loginCmsResponse></soapenv:Body></soapenv:Envelope>"
  );
}

describe("WsaaService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("extrae token, sign y vigencia del TA y lo guarda en la caché", async () => {
    stubFetchResponse(
      loginResponse(
        "<loginTicketResponse><header>" +
          "<generationTime>2026-09-24T10:00:00.000-03:00</generationTime>" +
          "<expirationTime>2026-09-24T22:00:00.000-03:00</expirationTime>" +
          "</header><credentials><token>token-ta</token><sign>sign-ta</sign></credentials>" +
          "</loginTicketResponse>",
      ),
    );
    const { service, cachedTickets, recorder } = build();

    const ticket = await service.getAccessTicket(ticketRequest());

    expect(ticket.token).toBe("token-ta");
    expect(ticket.sign).toBe("sign-ta");
    expect(ticket.expiration).toEqual(new Date("2026-09-24T22:00:00.000-03:00"));
    expect(ticket.generation).toEqual(new Date("2026-09-24T10:00:00.000-03:00"));
    expect(cachedTickets[0]?.token).toBe("token-ta");
    expect(recorder.last()?.outcome).toBe(ArcaCallOutcome.SUCCESS);
  });

  it("incluye el faultstring cuando WSAA no devuelve el TA", async () => {
    stubFetchResponse("<soapenv:Envelope><faultstring>cms.cert.untrusted</faultstring></soapenv:Envelope>");
    const { service } = build();

    await expect(service.getAccessTicket(ticketRequest())).rejects.toThrow(
      "WSAA no devolvió un TA: cms.cert.untrusted.",
    );
  });

  it("avisa sin detalle cuando la respuesta no trae TA ni faultstring", async () => {
    stubFetchResponse("<soapenv:Envelope><vacio/></soapenv:Envelope>");
    const { service } = build();

    await expect(service.getAccessTicket(ticketRequest())).rejects.toThrow("WSAA no devolvió un TA.");
  });

  it("rechaza un TA sin token ni sign", async () => {
    stubFetchResponse(loginResponse("<loginTicketResponse><header/></loginTicketResponse>"));
    const { service } = build();

    await expect(service.getAccessTicket(ticketRequest())).rejects.toThrow(
      "No se pudieron extraer token/sign de la respuesta de WSAA.",
    );
  });
});
