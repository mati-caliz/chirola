import {
  alicuotaIvaAfipId,
  requiereCuitReceptor,
  type Item,
} from '@chirola/shared';
import type { AlicuotaIvaArca, ImportesComprobante } from './wsfe.types';

/** Redondeo a 2 decimales (centavos), como exige ARCA. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula los importes de un comprobante a partir de sus ítems.
 *
 * Convención (igual que la implementación probada de gastronova): el
 * `precioUnit` de cada ítem es el importe **con IVA incluido** (bruto). Para
 * comprobantes clase A se discrimina el IVA agrupando por alícuota; para B/C
 * no se discrimina (`ImpNeto = ImpTotal`, `ImpIVA = 0`, sin array `<ar:Iva>`).
 *
 * Regla de oro ARCA: `ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpOpEx`. Acá
 * `ImpTrib` e `ImpOpEx` son 0, así que debe cuadrar `Total = Neto + IVA`.
 */
export function calcularImportes(
  tipoCbte: number,
  items: Item[],
): ImportesComprobante {
  const impTotal = round2(
    items.reduce((acc, it) => acc + it.cantidad * it.precioUnit, 0),
  );

  // Clase B/C: no se discrimina IVA.
  if (!requiereCuitReceptor(tipoCbte)) {
    return { impNeto: impTotal, impIva: 0, impTotal, alicuotas: [] };
  }

  // Clase A: agrupar el bruto por alícuota y extraer neto + IVA de cada grupo.
  const brutoPorAlicuota = new Map<number, number>();
  for (const it of items) {
    const bruto = it.cantidad * it.precioUnit;
    brutoPorAlicuota.set(
      it.alicuotaIva,
      (brutoPorAlicuota.get(it.alicuotaIva) ?? 0) + bruto,
    );
  }

  const alicuotas: AlicuotaIvaArca[] = [];
  let impNeto = 0;
  let impIva = 0;

  for (const [alicuota, brutoRaw] of brutoPorAlicuota) {
    const bruto = round2(brutoRaw);
    const baseImp = round2(bruto / (1 + alicuota / 100));
    const importe = round2(bruto - baseImp);
    impNeto = round2(impNeto + baseImp);
    impIva = round2(impIva + importe);

    const id = alicuotaIvaAfipId[alicuota];
    if (id === undefined) {
      throw new Error(`Alícuota de IVA no mapeada a Id de ARCA: ${alicuota}`);
    }
    alicuotas.push({ id, baseImp, importe });
  }

  return { impNeto, impIva, impTotal, alicuotas };
}
