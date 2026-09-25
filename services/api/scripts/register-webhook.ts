import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hasText } from "@chirola/shared";

const API_CLIENT_ARGUMENT_INDEX = 2;
const URL_ARGUMENT_INDEX = 3;
const WEBHOOK_SECRET_BYTES = 32;

async function main(): Promise<void> {
  const apiClientId = process.argv[API_CLIENT_ARGUMENT_INDEX];
  const url = process.argv[URL_ARGUMENT_INDEX];
  if (!hasText(apiClientId) || !hasText(url)) {
    throw new Error("Uso: ts-node scripts/register-webhook.ts <apiClientId> <url>");
  }

  const prisma = new PrismaClient();
  try {
    const secret = randomBytes(WEBHOOK_SECRET_BYTES).toString("base64url");
    const endpoint = await prisma.webhookEndpoint.create({
      data: { apiClientId, url, secret },
    });
    console.log(`Webhook registrado: ${endpoint.id} -> ${url}`);
    console.log("");
    console.log("Secret HMAC (guardalo, no se vuelve a mostrar):");
    console.log(secret);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
