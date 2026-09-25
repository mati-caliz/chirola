import type * as forge from "node-forge";
import { CUIT_LENGTH, normalizeCuit } from "@chirola/shared";

const SUBJECT_SERIAL_NUMBER_FIELD = "serialNumber";

export function certificateHolderCuit(cert: forge.pki.Certificate): string | null {
  const field: unknown = cert.subject.getField({ name: SUBJECT_SERIAL_NUMBER_FIELD });
  if (typeof field !== "object" || field === null || !("value" in field)) return null;
  if (typeof field.value !== "string") return null;
  const digits = normalizeCuit(field.value);
  return digits.length === CUIT_LENGTH ? digits : null;
}
