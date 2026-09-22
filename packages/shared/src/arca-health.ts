export interface ArcaHealth {
  environment: string;
  appServer: boolean;
  dbServer: boolean;
  authServer: boolean;
  available: boolean;
  checkedAt: string;
}
