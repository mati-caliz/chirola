import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.util";

const ENV_KEY_PATTERN = /^[A-Z0-9_]+$/;
const LINE_TERMINATOR_PATTERN = /[\r\u2028\u2029]/;

interface EnvEntry {
  key: string;
  value: string;
}

function isQuoted(value: string): boolean {
  return (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
}

function parseEnvLine(line: string): EnvEntry | null {
  const separatorIndex = line.indexOf("=");
  if (separatorIndex === -1) return null;
  const key = line.slice(0, separatorIndex).trim();
  const rawValue = line.slice(separatorIndex + 1);
  if (!ENV_KEY_PATTERN.test(key) || LINE_TERMINATOR_PATTERN.test(rawValue.trimStart())) return null;
  const value = rawValue.trim();
  return { key, value: isQuoted(value) ? value.slice(1, -1) : value };
}

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const entry = parseEnvLine(line);
      if (entry === null || process.env[entry.key] !== undefined) continue;
      process.env[entry.key] = entry.value;
    }
  } catch {
    return;
  }
}

loadEnvFile();

const email = process.env["DEMO_EMAIL"] ?? "demo@demo.com";
const password = process.env["DEMO_PASSWORD"] ?? "demo";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.user.upsert({
      where: { email },
      update: { password: hashPassword(password) },
      create: { email, password: hashPassword(password) },
    });
    console.log(`Usuario demo listo: ${email} / ${password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
