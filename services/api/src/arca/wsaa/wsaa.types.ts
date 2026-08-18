
export interface AccessTicket {
  token: string;
  sign: string;

  expiration: Date;
  generation: Date;
}

export interface CertificateCredentials {

  certPem: string;

  privateKeyPem: string;
}

export type ArcaService =
  | 'wsfe'
  | 'wsfex'
  | 'ws_sr_padron_a13'
  | 'ws_sr_constancia_inscripcion';
