const WSAA_FAULT_MESSAGES: Record<string, string> = {
  "coe.notAuthorized":
    "El certificado todavía no está autorizado a usar Facturación Electrónica. " +
    "En ARCA, entrá a Administrador de Relaciones de Clave Fiscal, agregá una nueva " +
    "relación al servicio AFIP > WebServices > Facturación Electrónica, y elegí como " +
    "representante el certificado que cargaste.",
  "cms.cert.untrusted":
    "ARCA no reconoce el certificado. Suele pasar cuando el certificado es de " +
    "producción y el emisor está configurado en homologación, o al revés.",
  "cms.cert.expired": "El certificado venció. Hay que generar un pedido nuevo en ARCA y volver a cargarlo.",
  "cms.cert.notFound": "El certificado no llegó completo a ARCA. Hay que volver a cargarlo.",
  "cms.sign.invalid":
    "La firma del pedido no es válida. Hay que generar el CSR de nuevo y volver a " +
    "pedirle el certificado a ARCA.",
  "cms.bad.base64": "ARCA no pudo leer el pedido de autenticación. Hay que volver a cargar el certificado.",
};

function withoutNamespacePrefix(qualifiedName: string): string {
  return qualifiedName.slice(qualifiedName.indexOf(":") + 1);
}

function knownFaultMessage(soapXml: string): string | undefined {
  const qualifiedCode = /<faultcode[^>]*>([^<]+)<\/faultcode>/.exec(soapXml)?.[1];
  if (qualifiedCode === undefined) return undefined;
  const code = withoutNamespacePrefix(qualifiedCode);
  return code === "" ? undefined : WSAA_FAULT_MESSAGES[code.trim()];
}

export function wsaaFaultMessage(soapXml: string, httpStatus: number): string {
  const known = knownFaultMessage(soapXml);
  if (known !== undefined && known !== "") return known;

  const fault = /<faultstring[^>]*>([^<]+)<\/faultstring>/.exec(soapXml)?.[1];
  return fault === undefined
    ? `WSAA devolvió error HTTP ${httpStatus}.`
    : `ARCA rechazó la autenticación: ${fault.trim()}`;
}
