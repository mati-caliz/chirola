import { callSoap, responseErrorCodes } from './arca-soap.util';
import { ArcaCallOutcome } from './arca-call-log.service';
import { RecordedArcaCalls } from './arca-call-recorder.fixture';

const URL = 'https://wsfe.test/service';
const OPERATION = 'FECAESolicitar';

function logContext(recorder: RecordedArcaCalls) {
  return { issuerId: 'issuer-1', service: 'wsfe' as const, recorder };
}

describe('callSoap — registro de llamadas (D.2)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function respondWith(body: string, status = 200): void {
    global.fetch = (async () => new Response(body, { status })) as typeof fetch;
  }

  it('registra una llamada exitosa con la duración y el estado HTTP', async () => {
    const recorder = new RecordedArcaCalls();
    respondWith('<Resultado>A</Resultado>');

    await callSoap(URL, OPERATION, '<envelope/>', logContext(recorder));

    const entry = recorder.last();
    expect(entry?.outcome).toBe(ArcaCallOutcome.SUCCESS);
    expect(entry?.httpStatus).toBe(200);
    expect(entry?.operation).toBe(OPERATION);
    expect(entry?.issuerId).toBe('issuer-1');
    expect(entry?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('marca como rechazada la respuesta que trae Errors y guarda los códigos', async () => {
    const recorder = new RecordedArcaCalls();
    respondWith(
      '<Resultado>R</Resultado><Errors><Err><Code>10048</Code>' +
        '<Msg>El importe no cierra</Msg></Err></Errors>',
    );

    await callSoap(URL, OPERATION, '<envelope/>', logContext(recorder));

    expect(recorder.last()?.outcome).toBe(ArcaCallOutcome.REJECTED);
    expect(recorder.last()?.errorCodes).toEqual(['10048']);
  });

  it('registra el fault HTTP antes de propagar el error', async () => {
    const recorder = new RecordedArcaCalls();
    respondWith('<faultstring>computador no autorizado</faultstring>', 500);

    await expect(
      callSoap(URL, OPERATION, '<envelope/>', logContext(recorder)),
    ).rejects.toThrow();

    expect(recorder.last()?.outcome).toBe(ArcaCallOutcome.FAULT);
    expect(recorder.last()?.httpStatus).toBe(500);
  });

  it('registra la caída de red, que es la que no deja rastro en ARCA', async () => {
    const recorder = new RecordedArcaCalls();
    global.fetch = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;

    await expect(
      callSoap(URL, OPERATION, '<envelope/>', logContext(recorder)),
    ).rejects.toThrow('ECONNRESET');

    expect(recorder.last()?.outcome).toBe(ArcaCallOutcome.NETWORK_ERROR);
    expect(recorder.last()?.responseXml).toContain('ECONNRESET');
  });

  it('no registra nada si no se le pasa contexto', async () => {
    const recorder = new RecordedArcaCalls();
    respondWith('<Resultado>A</Resultado>');

    await callSoap(URL, OPERATION, '<envelope/>');

    expect(recorder.entries).toHaveLength(0);
  });
});

describe('responseErrorCodes', () => {
  it('devuelve vacío si no hay bloque Errors', () => {
    expect(responseErrorCodes('<Resultado>A</Resultado>')).toEqual([]);
  });

  it('no confunde los códigos de Observaciones con los de Errors', () => {
    const xml =
      '<Observaciones><Obs><Code>10013</Code></Obs></Observaciones>' +
      '<Errors><Err><Code>10048</Code></Err></Errors>';

    expect(responseErrorCodes(xml)).toEqual(['10048']);
  });
});
