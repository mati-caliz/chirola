import { wsaaFaultMessage } from './wsaa-fault';

function fault(code: string, text = 'mensaje de ARCA'): string {
  return (
    '<soapenv:Envelope><soapenv:Body><soapenv:Fault>' +
    `<faultcode xmlns:ns1="http://xml.apache.org/axis/">ns1:${code}</faultcode>` +
    `<faultstring>${text}</faultstring>` +
    '</soapenv:Fault></soapenv:Body></soapenv:Envelope>'
  );
}

describe('wsaaFaultMessage', () => {
  it('explica que falta autorizar el certificado al servicio', () => {
    const message = wsaaFaultMessage(fault('coe.notAuthorized'), 500);
    expect(message).toContain('Administrador de Relaciones');
    expect(message).toContain('Facturación Electrónica');
  });

  it('explica el cruce de entorno cuando ARCA no confía en el certificado', () => {
    expect(wsaaFaultMessage(fault('cms.cert.untrusted'), 500)).toContain('homologación');
  });

  it('avisa cuando el certificado venció', () => {
    expect(wsaaFaultMessage(fault('cms.cert.expired'), 500)).toContain('venció');
  });

  it('cae en el faultstring de ARCA si el código no está mapeado', () => {
    expect(wsaaFaultMessage(fault('otro.error', 'Algo raro pasó'), 500)).toBe(
      'ARCA rechazó la autenticación: Algo raro pasó',
    );
  });

  it('cae en el HTTP status si la respuesta no es un fault', () => {
    expect(wsaaFaultMessage('<html>502 Bad Gateway</html>', 502)).toBe(
      'WSAA devolvió error HTTP 502.',
    );
  });
});
