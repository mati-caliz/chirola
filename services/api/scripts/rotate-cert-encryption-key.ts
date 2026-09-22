import { PrismaClient } from '@prisma/client';
import {
  decryptField,
  parseEncryptionKey,
  reencryptField,
} from '../src/crypto/field-cipher';

const CURRENT_KEY_VARIABLE = 'CERT_ENCRYPTION_KEY';
const NEW_KEY_VARIABLE = 'CERT_ENCRYPTION_KEY_NEW';
const APPLY_FLAG = '--apply';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const currentKey = parseEncryptionKey(
    process.env[CURRENT_KEY_VARIABLE] ?? '',
    CURRENT_KEY_VARIABLE,
  );
  const newKey = parseEncryptionKey(process.env[NEW_KEY_VARIABLE] ?? '', NEW_KEY_VARIABLE);
  if (currentKey.equals(newKey)) {
    throw new Error(`${NEW_KEY_VARIABLE} es igual a la clave actual: no hay nada que rotar.`);
  }
  const apply = process.argv.includes(APPLY_FLAG);

  const certificates = await prisma.certificate.findMany({
    select: { id: true, issuerId: true, privateKeyEnc: true },
  });
  const rotated = certificates.map((certificate) => {
    const privateKeyEnc = reencryptField(currentKey, newKey, certificate.privateKeyEnc);
    if (decryptField(newKey, privateKeyEnc) !== decryptField(currentKey, certificate.privateKeyEnc)) {
      throw new Error(`La verificación falló para el certificado ${certificate.id}.`);
    }
    return { id: certificate.id, privateKeyEnc };
  });

  console.log(`${rotated.length} claves privadas se descifran con la clave actual y se recifran bien.`);
  if (!apply) {
    console.log(`Simulación: no se escribió nada. Para aplicar, correr de nuevo con ${APPLY_FLAG}.`);
    return;
  }

  await prisma.$transaction(
    rotated.map(({ id, privateKeyEnc }) =>
      prisma.certificate.update({ where: { id }, data: { privateKeyEnc } }),
    ),
  );
  console.log(
    `Listo: ${rotated.length} claves recifradas. Ahora reemplazá ${CURRENT_KEY_VARIABLE} por el valor nuevo en el .env y levantá la API.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
