import { ApiKeyService } from './api-key.service';

describe('ApiKeyService', () => {
  const service = new ApiKeyService();

  it('compone y parsea una key round-trip', () => {
    const secret = service.generateSecret();
    const raw = service.compose('client-123', secret);
    expect(service.parse(raw)).toEqual({ clientId: 'client-123', secret });
  });

  it('verifica el secreto contra su hash', () => {
    const secret = service.generateSecret();
    const hash = service.hashSecret(secret);
    expect(service.verifySecret(secret, hash)).toBe(true);
    expect(service.verifySecret('otro', hash)).toBe(false);
  });

  it('rechaza keys mal formadas', () => {
    expect(service.parse('sin-separador')).toBeNull();
    expect(service.parse('.secret')).toBeNull();
    expect(service.parse('client.')).toBeNull();
  });

  it('genera secretos distintos cada vez', () => {
    expect(service.generateSecret()).not.toBe(service.generateSecret());
  });
});
