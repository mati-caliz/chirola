import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecipientIvaCondition } from '@chirola/shared';
import { PadronService } from './padron.service';
import { RecordedArcaCalls } from '../arca-call-recorder.fixture';

const recordedCalls = new RecordedArcaCalls();

function service(): PadronService {
  const config = {
    get: (_key: string, def?: string) => def,
  } as unknown as ConfigService;
  return new PadronService(config, recordedCalls);
}

const auth = {
  issuerId: 'issuer-1',
  cuit: '20111111112',
  token: 'token',
  sign: 'sign',
  environment: 'homologacion',
};

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function respondWith(xml: string, status = 200): void {
  global.fetch = (async () => new Response(xml, { status })) as unknown as typeof fetch;
}

function personaResponse(inner: string): string {
  return (
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>' +
    '<ns2:getPersonaResponse xmlns:ns2="http://a5.soap.ws.server.puc.sr/">' +
    `<personaReturn>${inner}</personaReturn>` +
    '</ns2:getPersonaResponse></soap:Body></soap:Envelope>'
  );
}

describe('PadronService', () => {
  it('extrae razón social, estado y domicilio de una persona jurídica', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales>' +
          '<razonSocial>ACME SOCIEDAD ANONIMA</razonSocial>' +
          '<tipoPersona>JURIDICA</tipoPersona>' +
          '<estadoClave>ACTIVO</estadoClave>' +
          '<domicilioFiscal>' +
          '<direccion>AV SIEMPREVIVA 742</direccion>' +
          '<localidad>CABA</localidad>' +
          '<codPostal>1425</codPostal>' +
          '<descripcionProvincia>CIUDAD AUTONOMA BUENOS AIRES</descripcionProvincia>' +
          '</domicilioFiscal>' +
          '</datosGenerales>' +
          '<datosRegimenGeneral><impuesto><idImpuesto>30</idImpuesto></impuesto></datosRegimenGeneral>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '30707153745');

    expect(taxpayer.legalName).toBe('ACME SOCIEDAD ANONIMA');
    expect(taxpayer.status).toBe('ACTIVO');
    expect(taxpayer.cuit).toBe('30707153745');
    expect(taxpayer.address).toEqual({
      street: 'AV SIEMPREVIVA 742',
      city: 'CABA',
      postalCode: '1425',
      province: 'CIUDAD AUTONOMA BUENOS AIRES',
    });
  });

  it('arma el nombre de una persona física con apellido y nombre', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales>' +
          '<apellido>PEREZ</apellido>' +
          '<nombre>JUAN</nombre>' +
          '<tipoPersona>FISICA</tipoPersona>' +
          '<estadoClave>ACTIVO</estadoClave>' +
          '</datosGenerales>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '20111111112');

    expect(taxpayer.legalName).toBe('PEREZ JUAN');
  });

  it('deduce responsable inscripto cuando está inscripto en IVA', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales><razonSocial>ACME SA</razonSocial></datosGenerales>' +
          '<datosRegimenGeneral><impuesto><idImpuesto>30</idImpuesto></impuesto></datosRegimenGeneral>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '30707153745');

    expect(taxpayer.ivaConditionId).toBe(
      RecipientIvaCondition.RESPONSABLE_INSCRIPTO,
    );
  });

  it('deduce monotributo cuando el padrón trae categoría', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales><apellido>PEREZ</apellido><nombre>JUAN</nombre></datosGenerales>' +
          '<datosMonotributo><categoriaMonotributo><idCategoria>12</idCategoria></categoriaMonotributo></datosMonotributo>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '20111111112');

    expect(taxpayer.ivaConditionId).toBe(RecipientIvaCondition.MONOTRIBUTO);
  });

  it('deduce sujeto exento cuando sólo figura el impuesto de exento', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales><razonSocial>FUNDACION X</razonSocial></datosGenerales>' +
          '<datosRegimenGeneral><impuesto><idImpuesto>32</idImpuesto></impuesto></datosRegimenGeneral>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '30707153745');

    expect(taxpayer.ivaConditionId).toBe(RecipientIvaCondition.SUJETO_EXENTO);
  });

  it('cae a consumidor final cuando no hay impuestos declarados', async () => {
    respondWith(
      personaResponse(
        '<datosGenerales><apellido>PEREZ</apellido><nombre>JUAN</nombre></datosGenerales>',
      ),
    );

    const taxpayer = await service().getTaxpayer(auth, '20111111112');

    expect(taxpayer.ivaConditionId).toBe(RecipientIvaCondition.CONSUMIDOR_FINAL);
  });

  it('devuelve null en domicilio cuando el padrón no lo informa', async () => {
    respondWith(
      personaResponse('<datosGenerales><razonSocial>ACME SA</razonSocial></datosGenerales>'),
    );

    const taxpayer = await service().getTaxpayer(auth, '30707153745');

    expect(taxpayer.address).toBeNull();
  });

  it('traduce el fault de CUIT inexistente en un 404', async () => {
    respondWith(
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault>' +
        '<faultcode>soap:Server</faultcode>' +
        '<faultstring>No existe persona con ese Id</faultstring>' +
        '</soap:Fault></soap:Body></soap:Envelope>',
      500,
    );

    await expect(service().getTaxpayer(auth, '20999999999')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('propaga los demás errores de ARCA sin convertirlos en 404', async () => {
    respondWith(
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><soap:Fault>' +
        '<faultstring>Token invalido</faultstring>' +
        '</soap:Fault></soap:Body></soap:Envelope>',
      500,
    );

    await expect(
      service().getTaxpayer(auth, '20111111112'),
    ).rejects.not.toBeInstanceOf(NotFoundException);
  });

  it('manda token, sign, cuit representada e idPersona en el envelope', async () => {
    let sentBody = '';
    global.fetch = (async (_url: string, init: { body: string }) => {
      sentBody = init.body;
      return new Response(
        personaResponse('<datosGenerales><razonSocial>ACME SA</razonSocial></datosGenerales>'),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    await service().getTaxpayer(auth, '30707153745');

    expect(sentBody).toContain('<token>token</token>');
    expect(sentBody).toContain('<sign>sign</sign>');
    expect(sentBody).toContain('<cuitRepresentada>20111111112</cuitRepresentada>');
    expect(sentBody).toContain('<idPersona>30707153745</idPersona>');
  });
});
