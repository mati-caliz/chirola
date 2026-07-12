import { InternalServerErrorException, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

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

export async function callSoap(
  url: string,
  soapAction: string,
  envelope: string,
): Promise<string> {
  logger.debug(`REQUEST ${soapAction}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: soapAction,
    },
    body: envelope,
  });
  const text = await res.text();
  if (!res.ok) {
    logger.error(`${soapAction} respondió HTTP ${res.status}: ${text}`);
    throw new InternalServerErrorException(
      `ARCA devolvió error HTTP ${res.status} en ${soapAction}.`,
    );
  }
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
