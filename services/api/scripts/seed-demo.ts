import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password.util';

function loadEnvFile(): void {
  try {
    const content = readFileSync(join(__dirname, '..', '.env'), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match) continue;
      const key = match[1];
      if (process.env[key] !== undefined) continue;
      let value = match[2].trim();
      const quoted =
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"));
      if (quoted) value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch {
    return;
  }
}

loadEnvFile();

const email = process.env.DEMO_EMAIL ?? 'demo@demo.com';
const password = process.env.DEMO_PASSWORD ?? 'demo';

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
