
export interface AccessTicket {
  token: string;
  sign: string;

  expiration: Date;
  generation: Date;
}

export interface CertificateCredentials {

  certPem: string;

  privateKeyPem: string;

  holderCuit: string | null;
}

export interface AccessTicketRequest {
  issuerId: string;

  holderCuit: string;

  environment: string;

  credentials: CertificateCredentials;

  service: ArcaService;
}

export type ArcaService =
  | 'wsfe'
  | 'wsfex'
  | 'ws_sr_padron_a13'
  | 'ws_sr_constancia_inscripcion';
