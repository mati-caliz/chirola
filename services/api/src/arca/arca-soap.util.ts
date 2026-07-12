import { InternalServerErrorException, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';

const logger = new Logger('ArcaSoap');
const parser = new XMLParser({ ignoreAttributes: false });

/** Escapa un valor para insertarlo como texto dentro de un nodo XML. */
export function escapeXml(value: string | null | undefined): string {
  if (value == null) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Bloque `<ar:Auth>` (token + sign + cuit) que WSFEv1 exige en cada request. */
export function buildAuthBlock(cuit: string, token: string, sign: string): string {
  return (
    '<ar:Auth>' +
    `<ar:Token>${escapeXml(token)}</ar:Token>` +
    `<ar:Sign>${escapeXml(sign)}</ar:Sign>` +
    `<ar:Cuit>${cuit}</ar:Cuit>` +
    '</ar:Auth>'
  );
}

/** POST de un envelope SOAP a un endpoint de ARCA y devuelve el body crudo. */
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

/** Parsea un XML de ARCA y expone helpers de extracción por tag. */
export class ParsedXml {
  private readonly root: Record<string, unknown>;

  constructor(xml: string) {
    this.root = parser.parse(xml) as Record<string, unknown>;
  }

  /** Primera aparición del tag (recursiva). Lanza si no existe. */
  required(tag: string): string {
    const value = this.find(tag);
    if (value == null) {
      throw new InternalServerErrorException(
        `Respuesta de ARCA sin el campo esperado <${tag}>.`,
      );
    }
    return String(value);
  }

  /** Primera aparición del tag o el default provisto. */
  optional(tag: string, fallback: string): string {
    const value = this.find(tag);
    return value == null ? fallback : String(value);
  }

  /** Lista de errores `<Err><Code/><Msg/></Err>` que devuelve WSFEv1. */
  errors(): string[] {
    const errRoot = this.find('Errors');
    if (errRoot == null || typeof errRoot !== 'object') return [];
    const out: string[] = [];
    const collect = (err: unknown): void => {
      if (err == null || typeof err !== 'object') return;
      const rec = err as Record<string, unknown>;
      const code = rec.Code != null ? String(rec.Code) : '';
      const msg = rec.Msg != null ? String(rec.Msg) : '';
      if (msg) out.push(code ? `(${code}) ${msg}` : msg);
    };
    const errNode = (errRoot as Record<string, unknown>).Err;
    if (Array.isArray(errNode)) errNode.forEach(collect);
    else collect(errNode);
    return out;
  }

  /** Búsqueda recursiva de la primera clave con ese nombre. */
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
