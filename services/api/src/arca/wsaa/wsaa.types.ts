/** Ticket de Acceso devuelto por WSAA, válido ~12h. */
export interface TicketAcceso {
  token: string;
  sign: string;
  /** Vencimiento del TA (según <expirationTime> de la respuesta). */
  expiration: Date;
  /** Momento de generación. */
  generation: Date;
}

/** Material criptográfico del contribuyente para firmar el LTR. */
export interface CredencialesCert {
  /** Certificado .crt en formato PEM (público). */
  certPem: string;
  /** Clave privada en formato PEM (sensible; llega descifrada desde el vault). */
  privateKeyPem: string;
}

/** Servicios de ARCA para los que se puede pedir un TA. */
export type ServicioArca = 'wsfe' | 'ws_sr_padron_a13' | 'ws_sr_constancia_inscripcion';
