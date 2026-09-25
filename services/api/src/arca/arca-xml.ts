import { XMLParser } from "fast-xml-parser";

export type XmlRecord = Record<string, unknown>;

const parser = new XMLParser({ ignoreAttributes: false });

const PLAIN_OBJECT_TEXT = "[object Object]";

export function isXmlRecord(value: unknown): value is XmlRecord {
  return typeof value === "object" && value !== null;
}

export function parseXml(xml: string): XmlRecord {
  const parsed: unknown = parser.parse(xml);
  return isXmlRecord(parsed) ? parsed : {};
}

export function xmlText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(xmlText).join(",");
  return PLAIN_OBJECT_TEXT;
}

export function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function isXmlScalar(value: unknown): boolean {
  return value !== undefined && value !== null && typeof value !== "object";
}

export function findByTag(node: unknown, tag: string): unknown {
  if (!isXmlRecord(node)) return undefined;
  if (tag in node) return node[tag];
  for (const value of Object.values(node)) {
    const found = findByTag(value, tag);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function collectRecordsByTag(node: unknown, tag: string): XmlRecord[] {
  if (!isXmlRecord(node)) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === tag ? asList(value).filter(isXmlRecord) : collectRecordsByTag(value, tag),
  );
}

export function collectScalarsByTag(node: unknown, tag: string): string[] {
  if (!isXmlRecord(node)) return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === tag ? asList(value).filter(isXmlScalar).map(xmlText) : collectScalarsByTag(value, tag),
  );
}
