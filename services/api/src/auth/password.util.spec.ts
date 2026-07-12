import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('verifica la contraseña correcta', () => {
    const hash = hashPassword('supersecreta');
    expect(verifyPassword('supersecreta', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', () => {
    const hash = hashPassword('supersecreta');
    expect(verifyPassword('otra', hash)).toBe(false);
  });

  it('genera hashes distintos por el salt aleatorio', () => {
    expect(hashPassword('x')).not.toBe(hashPassword('x'));
  });

  it('rechaza un hash con formato inválido', () => {
    expect(verifyPassword('x', 'no-es-un-hash')).toBe(false);
  });
});
