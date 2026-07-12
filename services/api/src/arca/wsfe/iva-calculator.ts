import {
  alicuotaIvaAfipId,
  requiereCuitReceptor,
  type Item,
} from '@chirola/shared';
import type { AlicuotaIvaArca, ImportesComprobante } from './wsfe.types';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function calcularImportes(
  tipoCbte: number,
  items: Item[],
): ImportesComprobante {
  const impTotal = round2(
    items.reduce((acc, it) => acc + it.cantidad * it.precioUnit, 0),
  );

  if (!requiereCuitReceptor(tipoCbte)) {
    return { impNeto: impTotal, impIva: 0, impTotal, alicuotas: [] };
  }

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
