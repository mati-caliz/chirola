import { PrismaClient } from '@prisma/client';
import { ApiKeyService } from '../src/service-auth/api-key.service';

async function main(): Promise<void> {
  const name = process.argv[2];
  const issuerIds = process.argv.slice(3);
  if (!name) {
    throw new Error(
      'Uso: ts-node scripts/create-api-client.ts <name> [issuerId ...]',
    );
  }

  const prisma = new PrismaClient();
  const apiKeys = new ApiKeyService();
  try {
    const secret = apiKeys.generateSecret();
    const client = await prisma.apiClient.create({
      data: { name, keyHash: apiKeys.hashSecret(secret) },
    });

    for (const issuerId of issuerIds) {
      await prisma.apiClientIssuer.create({
        data: { apiClientId: client.id, issuerId },
      });
    }

    const rawKey = apiKeys.compose(client.id, secret);
    console.log(`ApiClient creado: ${client.name} (${client.id})`);
    console.log(`Emisores habilitados: ${issuerIds.length ? issuerIds.join(', ') : 'ninguno'}`);
    console.log('');
    console.log('API key (guardala, no se vuelve a mostrar):');
    console.log(rawKey);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
