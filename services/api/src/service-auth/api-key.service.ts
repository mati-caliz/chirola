import { Injectable } from '@nestjs/common';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SECRET_BYTES = 32;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const HASH_PREFIX = 'scrypt';
const KEY_SEPARATOR = '.';

export interface ParsedApiKey {
  clientId: string;
  secret: string;
}

@Injectable()
export class ApiKeyService {
  generateSecret(): string {
    return randomBytes(SECRET_BYTES).toString('base64url');
  }

  compose(clientId: string, secret: string): string {
    return `${clientId}${KEY_SEPARATOR}${secret}`;
  }

  parse(rawKey: string): ParsedApiKey | null {
    const separatorIndex = rawKey.indexOf(KEY_SEPARATOR);
    if (separatorIndex <= 0 || separatorIndex === rawKey.length - 1) {
      return null;
    }
    return {
      clientId: rawKey.slice(0, separatorIndex),
      secret: rawKey.slice(separatorIndex + 1),
    };
  }

  hashSecret(secret: string): string {
    const salt = randomBytes(SALT_BYTES);
    const hash = scryptSync(secret, salt, KEY_LENGTH);
    return `${HASH_PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  verifySecret(secret: string, stored: string): boolean {
    const parts = stored.split('$');
    if (parts.length !== 3 || parts[0] !== HASH_PREFIX) {
      return false;
    }
    const salt = Buffer.from(parts[1], 'base64');
    const expected = Buffer.from(parts[2], 'base64');
    const actual = scryptSync(secret, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
