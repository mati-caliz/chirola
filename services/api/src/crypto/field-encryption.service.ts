import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

@Injectable()
export class FieldEncryptionService {
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;
  private readonly logger = new Logger(FieldEncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CERT_ENCRYPTION_KEY', '');
    if (!raw) {
      throw new InternalServerErrorException(
        'CERT_ENCRYPTION_KEY no configurada (base64 de 32 bytes). Generar con: openssl rand -base64 32',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new InternalServerErrorException(
        'CERT_ENCRYPTION_KEY debe ser base64 de 32 bytes (AES-256).',
      );
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(FieldEncryptionService.IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, enc, tag]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    try {
      const buf = Buffer.from(ciphertext, 'base64');
      const iv = buf.subarray(0, FieldEncryptionService.IV_LENGTH);
      const tag = buf.subarray(buf.length - FieldEncryptionService.TAG_LENGTH);
      const enc = buf.subarray(
        FieldEncryptionService.IV_LENGTH,
        buf.length - FieldEncryptionService.TAG_LENGTH,
      );
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
        'utf8',
      );
    } catch (err) {
      this.logger.error('Fallo al descifrar campo', err as Error);
      throw new InternalServerErrorException(
        'No se pudo descifrar la clave privada del certificado.',
      );
    }
  }
}
