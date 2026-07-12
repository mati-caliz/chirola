import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { FieldEncryptionService } from './field-encryption.service';

function serviceConKey(): FieldEncryptionService {
  const key = randomBytes(32).toString('base64');
  const config = {
    get: (k: string, def?: string) =>
      k === 'CERT_ENCRYPTION_KEY' ? key : def,
  } as unknown as ConfigService;
  return new FieldEncryptionService(config);
}

describe('FieldEncryptionService', () => {
  it('cifra y descifra ida y vuelta', () => {
    const svc = serviceConKey();
    const plano = '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----';
    const enc = svc.encrypt(plano);
    expect(enc).not.toContain('BEGIN PRIVATE KEY');
    expect(svc.decrypt(enc)).toBe(plano);
  });

  it('cada cifrado usa un IV distinto (no determinístico)', () => {
    const svc = serviceConKey();
    expect(svc.encrypt('x')).not.toBe(svc.encrypt('x'));
  });

  it('rechaza una key que no sea de 32 bytes', () => {
    const config = {
      get: (k: string, def?: string) =>
        k === 'CERT_ENCRYPTION_KEY' ? Buffer.from('corta').toString('base64') : def,
    } as unknown as ConfigService;
    expect(() => new FieldEncryptionService(config)).toThrow();
  });
});
