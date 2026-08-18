const REDACTED = '[REDACTADO]';

const SECRET_TAGS = ['Token', 'Sign', 'token', 'sign', 'in0', 'loginCmsReturn'];

const secretTagPattern = new RegExp(
  `(<(?:\\w+:)?(?:${SECRET_TAGS.join('|')})>)([\\s\\S]*?)(</(?:\\w+:)?(?:${SECRET_TAGS.join('|')})>)`,
  'g',
);

export function redactArcaXml(xml: string): string {
  return xml.replace(secretTagPattern, `$1${REDACTED}$3`);
}

export function truncateXml(xml: string, maxLength: number): string {
  if (xml.length <= maxLength) return xml;
  return `${xml.slice(0, maxLength)}… [truncado, ${xml.length} caracteres]`;
}
