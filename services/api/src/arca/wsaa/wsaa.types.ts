
export interface TicketAcceso {
  token: string;
  sign: string;

  expiration: Date;
  generation: Date;
}

export interface CredencialesCert {

  certPem: string;

  privateKeyPem: string;
}

export type ServicioArca = 'wsfe' | 'ws_sr_padron_a13' | 'ws_sr_constancia_inscripcion';
