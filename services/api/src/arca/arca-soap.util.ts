import { InternalServerErrorException, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { ArcaCallOutcome, type ArcaCallLogEntry } from './arca-call-log.service';
import type { ArcaService } from './wsaa/wsaa.types';

const logger = new Logger('ArcaSoap');
const parser = new XMLParser({ ignoreAttributes: false });

export function escapeXml(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildAuthBlock(cuit: string, token: string, sign: string): string {
  return (
    '<ar:Auth>' +
    `<ar:Token>${escapeXml(token)}</ar:Token>` +
    `<ar:Sign>${escapeXml(sign)}</ar:Sign>` +
    `<ar:Cuit>${cuit}</ar:Cuit>` +
    '</ar:Auth>'
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
    const match = this.body.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
    return match ? match[1].trim() : '';
  }
}

export const ARCA_CALL_RECORDER = 'ARCA_CALL_RECORDER';

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
  const errorsBlock = xml.match(/<Errors>([\s\S]*?)<\/Errors>/);
  if (!errorsBlock) return [];
  return [...errorsBlock[1].matchAll(/<Code>(\d+)<\/Code>/g)].map(
    (match) => match[1],
  );
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
    outcome: ArcaCallLogEntry['outcome'],
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
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
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

export class ParsedXml {
  private readonly root: Record<string, unknown>;

  constructor(xml: string) {
    this.root = parser.parse(xml) as Record<string, unknown>;
  }

  required(tag: string): string {
    const value = this.find(tag);
    if (value == null) {
      throw new InternalServerErrorException(
        `Respuesta de ARCA sin el campo esperado <${tag}>.`,
      );
    }
    return String(value);
  }

  optional(tag: string, fallback: string): string {
    const value = this.find(tag);
    return value == null ? fallback : String(value);
  }

  has(tag: string): boolean {
    return this.find(tag) !== undefined;
  }

  all(tag: string): string[] {
    const out: string[] = [];
    const walk = (node: unknown): void => {
      if (node == null || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        if (key === tag) {
          for (const entry of Array.isArray(value) ? value : [value]) {
            if (entry != null && typeof entry !== 'object') out.push(String(entry));
          }
        } else {
          walk(value);
        }
      }
    };
    walk(this.root);
    return out;
  }

  errors(): string[] {
    return this.errorEntries().map(({ code, message }) =>
      code ? `(${code}) ${message}` : message,
    );
  }

  errorCodes(): string[] {
    return this.errorEntries()
      .map(({ code }) => code)
      .filter((code): code is string => code.length > 0);
  }

  private errorEntries(): { code: string; message: string }[] {
    const errRoot = this.find('Errors');
    if (errRoot == null || typeof errRoot !== 'object') return [];
    const out: { code: string; message: string }[] = [];
    const collect = (err: unknown): void => {
      if (err == null || typeof err !== 'object') return;
      const rec = err as Record<string, unknown>;
      const code = rec.Code != null ? String(rec.Code) : '';
      const message = rec.Msg != null ? String(rec.Msg) : '';
      if (message) out.push({ code, message });
    };
    const errNode = (errRoot as Record<string, unknown>).Err;
    if (Array.isArray(errNode)) errNode.forEach(collect);
    else collect(errNode);
    return out;
  }

  private find(tag: string, obj: unknown = this.root): unknown {
    if (obj == null || typeof obj !== 'object') return undefined;
    const rec = obj as Record<string, unknown>;
    if (tag in rec && typeof rec[tag] !== 'object') return rec[tag];
    if (tag in rec) return rec[tag];
    for (const value of Object.values(rec)) {
      const found = this.find(tag, value);
      if (found !== undefined) return found;
    }
    return undefined;
  }
}
