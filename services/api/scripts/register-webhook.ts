import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const apiClientId = process.argv[2];
  const url = process.argv[3];
  if (!apiClientId || !url) {
    throw new Error(
      'Uso: ts-node scripts/register-webhook.ts <apiClientId> <url>',
    );
  }

  const prisma = new PrismaClient();
  try {
    const secret = randomBytes(32).toString('base64url');
    const endpoint = await prisma.webhookEndpoint.create({
      data: { apiClientId, url, secret },
    });
    console.log(`Webhook registrado: ${endpoint.id} -> ${url}`);
    console.log('');
    console.log('Secret HMAC (guardalo, no se vuelve a mostrar):');
    console.log(secret);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
