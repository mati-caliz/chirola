import { InternalServerErrorException, Logger } from "@nestjs/common";
import { ArcaCallOutcome, type ArcaCallLogEntry } from "./arca-call-log.service";
import {
  asList,
  collectScalarsByTag,
  findByTag,
  isXmlRecord,
  parseXml,
  xmlText,
  type XmlRecord,
} from "./arca-xml";
import type { ArcaService } from "./wsaa/wsaa.types";

const logger = new Logger("ArcaSoap");

export function escapeXml(value: string | null | undefined): string {
  if (value === undefined || value === null) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildAuthBlock(cuit: string, token: string, sign: string): string {
  return (
    "<ar:Auth>" +
    `<ar:Token>${escapeXml(token)}</ar:Token>` +
    `<ar:Sign>${escapeXml(sign)}</ar:Sign>` +
    `<ar:Cuit>${cuit}</ar:Cuit>` +
    "</ar:Auth>"
  );
}

export class ArcaSoapFaultError extends InternalServerErrorException {
  constructor(
    readonly soapAction: string,
    readonly httpStatus: number,
    readonly body: string,
  ) {
    super(`ARCA devolvió error HTTP ${httpStatus} en ${soapAction}.`);
  }

  faultString(): string {
    const match = /<faultstring>([\s\S]*?)<\/faultstring>/.exec(this.body);
    return match?.[1]?.trim() ?? "";
  }
}

export const ARCA_CALL_RECORDER = "ARCA_CALL_RECORDER";

export interface ArcaCallRecorder {
  record(entry: ArcaCallLogEntry): Promise<void>;
}

export interface ArcaCallLogContext {
  issuerId: string | null;
  service: ArcaService;
  recorder: ArcaCallRecorder;
}

const NO_HTTP_RESPONSE = 0;

export function responseErrorCodes(xml: string): string[] {
  const errorsBlock = /<Errors>([\s\S]*?)<\/Errors>/.exec(xml)?.[1];
  if (errorsBlock === undefined) return [];
  return [...errorsBlock.matchAll(/<Code>(\d+)<\/Code>/g)].flatMap((match) => match[1] ?? []);
}

export async function callSoap(
  url: string,
  soapAction: string,
  envelope: string,
  logContext?: ArcaCallLogContext,
): Promise<string> {
  logger.debug(`REQUEST ${soapAction}`);
  const startedAt = Date.now();

  const record = async (
    outcome: ArcaCallLogEntry["outcome"],
    httpStatus: number,
    responseXml: string,
    errorCodes?: string[],
  ): Promise<void> => {
    if (!logContext) return;
    await logContext.recorder.record({
      issuerId: logContext.issuerId,
      service: logContext.service,
      operation: soapAction,
      httpStatus,
      durationMs: Date.now() - startedAt,
      outcome,
      errorCodes,
      requestXml: envelope,
      responseXml,
    });
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: soapAction,
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
    logger.error(`${soapAction} respondió HTTP ${res.status}: ${text}`);
    await record(ArcaCallOutcome.FAULT, res.status, text);
    throw new ArcaSoapFaultError(soapAction, res.status, text);
  }

  const errorCodes = responseErrorCodes(text);
  await record(
    errorCodes.length > 0 ? ArcaCallOutcome.REJECTED : ArcaCallOutcome.SUCCESS,
    res.status,
    text,
    errorCodes,
  );
  return text;
}

export interface CodedEntry {
  code: string;
  message: string;
}

function isMissing(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

function codedEntry(entry: unknown): CodedEntry[] {
  if (!isXmlRecord(entry)) return [];
  const message = xmlText(entry["Msg"]);
  return message === "" ? [] : [{ code: xmlText(entry["Code"]), message }];
}

export class ParsedXml {
  private readonly root: XmlRecord;

  constructor(xml: string) {
    this.root = parseXml(xml);
  }

  required(tag: string): string {
    const value = this.find(tag);
    if (isMissing(value)) {
      throw new InternalServerErrorException(`Respuesta de ARCA sin el campo esperado <${tag}>.`);
    }
    return xmlText(value);
  }

  optional(tag: string, fallback: string): string {
    const value = this.find(tag);
    return isMissing(value) ? fallback : xmlText(value);
  }

  raw(): XmlRecord {
    return this.root;
  }

  has(tag: string): boolean {
    return this.find(tag) !== undefined;
  }

  all(tag: string): string[] {
    return collectScalarsByTag(this.root, tag);
  }

  errors(): string[] {
    return this.errorEntries().map(({ code, message }) => (code === "" ? message : `(${code}) ${message}`));
  }

  errorCodes(): string[] {
    return this.errorEntries()
      .map(({ code }) => code)
      .filter((code): code is string => code.length > 0);
  }

  observations(): CodedEntry[] {
    return this.codedEntries("Observaciones", "Obs");
  }

  private errorEntries(): CodedEntry[] {
    return this.codedEntries("Errors", "Err");
  }

  private codedEntries(rootTag: string, itemTag: string): CodedEntry[] {
    const root = this.find(rootTag);
    if (!isXmlRecord(root)) return [];
    return asList(root[itemTag]).flatMap(codedEntry);
  }

  private find(tag: string): unknown {
    return findByTag(this.root, tag);
  }
}
