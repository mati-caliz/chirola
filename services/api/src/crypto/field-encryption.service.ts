import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { decryptField, encryptField, InvalidEncryptionKeyError, parseEncryptionKey } from "./field-cipher";

const KEY_VARIABLE = "CERT_ENCRYPTION_KEY";

@Injectable()
export class FieldEncryptionService {
  private readonly logger = new Logger(FieldEncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    try {
      this.key = parseEncryptionKey(config.get<string>(KEY_VARIABLE, ""), KEY_VARIABLE);
    } catch (err) {
      if (err instanceof InvalidEncryptionKeyError) {
        throw new InternalServerErrorException(err.message);
      }
      throw err;
    }
  }

  encrypt(plaintext: string): string {
    return encryptField(this.key, plaintext);
  }

  decrypt(ciphertext: string): string {
    try {
      return decryptField(this.key, ciphertext);
    } catch (err) {
      this.logger.error("Fallo al descifrar campo", err);
      throw new InternalServerErrorException("No se pudo descifrar la clave privada del certificado.");
    }
  }
}
