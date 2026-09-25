export const TributeType = {
  NATIONAL: 1,
  PROVINCIAL: 2,
  MUNICIPAL: 3,
  INTERNAL: 4,
  OTHER: 99,
} as const;

export const tributeTypeName: Record<number, string> = {
  1: "Impuestos nacionales",
  2: "Impuestos provinciales",
  3: "Impuestos municipales",
  4: "Impuestos internos",
  99: "Otros",
};

const nationalIndirectTributeTypes: readonly number[] = [TributeType.NATIONAL, TributeType.INTERNAL];

export function isNationalIndirectTribute(tributeType: number): boolean {
  return nationalIndirectTributeTypes.includes(tributeType);
}
