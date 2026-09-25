import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const SALT_BYTES = 16;
const HASH_SEGMENT_COUNT = 3;
const HASH_SCHEME = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, KEYLEN);
  return `${HASH_SCHEME}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  const [scheme, encodedSalt, encodedHash] = parts;
  if (parts.length !== HASH_SEGMENT_COUNT || scheme !== HASH_SCHEME) return false;
  if (encodedSalt === undefined || encodedHash === undefined) return false;
  const salt = Buffer.from(encodedSalt, "base64");
  const expected = Buffer.from(encodedHash, "base64");
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
