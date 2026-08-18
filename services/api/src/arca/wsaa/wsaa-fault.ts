const WSAA_FAULT_MESSAGES: Record<string, string> = {
  'coe.notAuthorized':
    'El certificado todavía no está autorizado a usar Facturación Electrónica. ' +
    'En ARCA, entrá a Administrador de Relaciones de Clave Fiscal, agregá una nueva ' +
    'relación al servicio AFIP > WebServices > Facturación Electrónica, y elegí como ' +
    'representante el certificado que cargaste.',
  'cms.cert.untrusted':
    'ARCA no reconoce el certificado. Suele pasar cuando el certificado es de ' +
    'producción y el emisor está configurado en homologación, o al revés.',
  'cms.cert.expired':
    'El certificado venció. Hay que generar un pedido nuevo en ARCA y volver a cargarlo.',
  'cms.cert.notFound':
    'El certificado no llegó completo a ARCA. Hay que volver a cargarlo.',
  'cms.sign.invalid':
    'La firma del pedido no es válida. Hay que generar el CSR de nuevo y volver a ' +
    'pedirle el certificado a ARCA.',
  'cms.bad.base64':
    'ARCA no pudo leer el pedido de autenticación. Hay que volver a cargar el certificado.',
};

export function wsaaFaultMessage(soapXml: string, httpStatus: number): string {
  const code = /<faultcode[^>]*>(?:[^:<]*:)?([^<]+)<\/faultcode>/.exec(soapXml)?.[1];
  const known = code ? WSAA_FAULT_MESSAGES[code.trim()] : undefined;
  if (known) return known;

  const fault = /<faultstring[^>]*>([^<]+)<\/faultstring>/.exec(soapXml)?.[1];
  return fault
    ? `ARCA rechazó la autenticación: ${fault.trim()}`
    : `WSAA devolvió error HTTP ${httpStatus}.`;
}
