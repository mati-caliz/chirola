import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class InvalidEncryptionKeyError extends Error {}

export function parseEncryptionKey(raw: string, variableName: string): Buffer {
  if (!raw) {
    throw new InvalidEncryptionKeyError(
      `${variableName} no configurada (base64 de 32 bytes). Generar con: openssl rand -base64 32`,
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_LENGTH) {
    throw new InvalidEncryptionKeyError(
      `${variableName} debe ser base64 de 32 bytes (AES-256).`,
    );
  }
  return key;
}

export function encryptField(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString('base64');
}

export function decryptField(key: Buffer, ciphertext: string): string {
  const buffer = Buffer.from(ciphertext, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(buffer.length - TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH, buffer.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function reencryptField(oldKey: Buffer, newKey: Buffer, ciphertext: string): string {
  return encryptField(newKey, decryptField(oldKey, ciphertext));
}
