const REDACTED = "[REDACTADO]";

const secretTagPattern =
  /(<(?:\w+:|)(?:Token|Sign|token|sign|in0|loginCmsReturn)>)([\s\S]*?)(<\/(?:\w+:|)(?:Token|Sign|token|sign|in0|loginCmsReturn)>)/g;

export function redactArcaXml(xml: string): string {
  return xml.replace(secretTagPattern, `$1${REDACTED}$3`);
}

export function truncateXml(xml: string, maxLength: number): string {
  if (xml.length <= maxLength) return xml;
  return `${xml.slice(0, maxLength)}… [truncado, ${xml.length} caracteres]`;
}
