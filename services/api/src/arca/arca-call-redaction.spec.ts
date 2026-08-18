import { redactArcaXml, truncateXml } from './arca-call-redaction';

describe('redactArcaXml', () => {
  it('tapa el token y la firma del bloque Auth de WSFEv1', () => {
    const xml =
      '<ar:Auth><ar:Token>PD94bWwgdmVyc2lvbj0i</ar:Token>' +
      '<ar:Sign>c2lnbmF0dXJl</ar:Sign><ar:Cuit>20111111112</ar:Cuit></ar:Auth>';

    const redacted = redactArcaXml(xml);

    expect(redacted).not.toContain('PD94bWwgdmVyc2lvbj0i');
    expect(redacted).not.toContain('c2lnbmF0dXJl');
    expect(redacted).toContain('<ar:Cuit>20111111112</ar:Cuit>');
  });

  it('tapa el CMS firmado que se manda a WSAA', () => {
    const xml = '<wsaa:loginCms><wsaa:in0>MIIHtwYJKoZIhvcNAQ</wsaa:in0></wsaa:loginCms>';

    expect(redactArcaXml(xml)).not.toContain('MIIHtwYJKoZIhvcNAQ');
  });

  it('tapa el ticket de acceso que devuelve WSAA', () => {
    const xml =
      '<loginCmsReturn>&lt;token&gt;PD94bWw&lt;/token&gt;' +
      '&lt;sign&gt;firma&lt;/sign&gt;</loginCmsReturn>';

    const redacted = redactArcaXml(xml);

    expect(redacted).not.toContain('PD94bWw');
    expect(redacted).not.toContain('firma');
  });

  it('deja intacto el resto del comprobante', () => {
    const xml =
      '<ar:FECAEDetRequest><ar:Concepto>1</ar:Concepto>' +
      '<ar:ImpTotal>1210.00</ar:ImpTotal></ar:FECAEDetRequest>';

    expect(redactArcaXml(xml)).toBe(xml);
  });
});

describe('truncateXml', () => {
  it('no toca un XML dentro del límite', () => {
    expect(truncateXml('<a/>', 100)).toBe('<a/>');
  });

  it('corta e informa el tamaño original', () => {
    const truncated = truncateXml('x'.repeat(50), 10);

    expect(truncated.startsWith('xxxxxxxxxx')).toBe(true);
    expect(truncated).toContain('50 caracteres');
  });
});
