export function optionalField<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  if (value === undefined) return {};
  const field: Partial<Record<Key, Value>> = {};
  field[key] = value;
  return field;
}
