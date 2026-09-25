export function hasText(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value !== "";
}
