const PRODUCTION_ENVIRONMENT = 'produccion';

export interface ArcaIssuer {
  id: string;
  cuit: string;
  environment: string;
}

export function isProduction(environment: string): boolean {
  return environment === PRODUCTION_ENVIRONMENT;
}
