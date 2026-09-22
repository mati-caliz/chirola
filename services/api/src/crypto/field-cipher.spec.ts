import { randomBytes } from 'node:crypto';
import { decryptField, encryptField, reencryptField } from './field-cipher';

const KEY_LENGTH = 32;

describe('reencryptField', () => {
  it('deja el dato legible sólo con la clave nueva', () => {
    const oldKey = randomBytes(KEY_LENGTH);
    const newKey = randomBytes(KEY_LENGTH);
    const secret = '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----';

    const rotated = reencryptField(oldKey, newKey, encryptField(oldKey, secret));

    expect(decryptField(newKey, rotated)).toBe(secret);
    expect(() => decryptField(oldKey, rotated)).toThrow();
  });
});
