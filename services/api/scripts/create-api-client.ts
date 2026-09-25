import { PrismaClient } from "@prisma/client";
import { hasText } from "@chirola/shared";
import { ApiKeyService } from "../src/service-auth/api-key.service";

const NAME_ARGUMENT_INDEX = 2;
const FIRST_ISSUER_ARGUMENT_INDEX = 3;

async function main(): Promise<void> {
  const name = process.argv[NAME_ARGUMENT_INDEX];
  const issuerIds = process.argv.slice(FIRST_ISSUER_ARGUMENT_INDEX);
  if (!hasText(name)) {
    throw new Error("Uso: ts-node scripts/create-api-client.ts <name> [issuerId ...]");
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
    console.log(`Emisores habilitados: ${issuerIds.length > 0 ? issuerIds.join(", ") : "ninguno"}`);
    console.log("");
    console.log("API key (guardala, no se vuelve a mostrar):");
    console.log(rawKey);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
