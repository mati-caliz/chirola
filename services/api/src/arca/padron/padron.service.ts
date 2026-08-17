import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  inferRecipientIvaCondition,
  TaxpayerStatus,
  type TaxpayerAddress,
  type TaxpayerInfo,
} from '@chirola/shared';
import { ArcaSoapFaultError, callSoap, escapeXml, ParsedXml } from '../arca-soap.util';
import type { AuthContext } from '../wsfe/wsfe.types';

const PADRON_A5_NS = 'http://a5.soap.ws.server.puc.sr/';
const NOT_FOUND_FAULT = 'No existe persona con ese Id';
const NATURAL_PERSON = 'FISICA';

@Injectable()
export class PadronService {
  private readonly logger = new Logger(PadronService.name);

  constructor(private readonly config: ConfigService) {}

  private get padronUrl(): string {
    const env = this.config.get<string>('ARCA_ENV', 'homologacion');
    return env === 'produccion'
      ? this.config.get<string>(
          'ARCA_PADRON_A5_URL_PROD',
          'https://aws.afip.gov.ar/sr-padron/webservices/personaServiceA5',
        )
      : this.config.get<string>(
          'ARCA_PADRON_A5_URL_HOMO',
          'https://awshomo.afip.gov.ar/sr-padron/webservices/personaServiceA5',
        );
  }

  async getTaxpayer(auth: AuthContext, cuit: string): Promise<TaxpayerInfo> {
    const envelope =
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:a5="${PADRON_A5_NS}">` +
      '<soapenv:Header/>' +
      '<soapenv:Body>' +
      '<a5:getPersona>' +
      `<token>${escapeXml(auth.token)}</token>` +
      `<sign>${escapeXml(auth.sign)}</sign>` +
      `<cuitRepresentada>${auth.cuit}</cuitRepresentada>` +
      `<idPersona>${cuit}</idPersona>` +
      '</a5:getPersona>' +
      '</soapenv:Body>' +
      '</soapenv:Envelope>';

    const response = await this.callPadron(envelope, cuit);
    return this.parseTaxpayer(response, cuit);
  }

  private async callPadron(envelope: string, cuit: string): Promise<string> {
    try {
      return await callSoap(this.padronUrl, `${PADRON_A5_NS}getPersona`, envelope);
    } catch (err) {
      if (
        err instanceof ArcaSoapFaultError &&
        err.faultString().includes(NOT_FOUND_FAULT)
      ) {
        throw new NotFoundException(`No existe un contribuyente con CUIT ${cuit}.`);
      }
      throw err;
    }
  }

  private parseTaxpayer(response: string, cuit: string): TaxpayerInfo {
    const xml = new ParsedXml(response);

    const taxIds = xml
      .all('idImpuesto')
      .map(Number)
      .filter((id) => !Number.isNaN(id));
    const hasMonotributo = xml.has('categoriaMonotributo');

    const taxpayer: TaxpayerInfo = {
      cuit,
      legalName: this.parseLegalName(xml),
      status: xml.optional('estadoClave', TaxpayerStatus.INACTIVE),
      ivaConditionId: inferRecipientIvaCondition({ taxIds, hasMonotributo }),
      address: this.parseAddress(xml),
    };
    this.logger.log(`Padrón consultado para ${cuit}: ${taxpayer.legalName}`);
    return taxpayer;
  }

  private parseLegalName(xml: ParsedXml): string {
    const businessName = xml.optional('razonSocial', '');
    if (businessName) return businessName;

    const personType = xml.optional('tipoPersona', '');
    const lastName = xml.optional('apellido', '');
    const firstName = xml.optional('nombre', '');
    if (personType === NATURAL_PERSON || lastName || firstName) {
      return [lastName, firstName].filter(Boolean).join(' ').trim();
    }
    return '';
  }

  private parseAddress(xml: ParsedXml): TaxpayerAddress | null {
    const street = xml.optional('direccion', '');
    const city = xml.optional('localidad', '');
    const postalCode = xml.optional('codPostal', '');
    const province = xml.optional('descripcionProvincia', '');
    if (!street && !city && !postalCode && !province) return null;
    return {
      street: street || null,
      city: city || null,
      postalCode: postalCode || null,
      province: province || null,
    };
  }
}
