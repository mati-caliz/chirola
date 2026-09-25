import { hasText } from "@chirola/shared";

export function parseOptionalDate(value: string | null | undefined): Date | undefined {
  return hasText(value) ? new Date(value) : undefined;
}

export function parseOptionalNumber(value: string | undefined): number | undefined {
  return hasText(value) ? Number(value) : undefined;
}
