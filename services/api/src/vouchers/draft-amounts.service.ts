import { Injectable } from "@nestjs/common";
import type { DraftAmounts, DraftAmountsInput } from "@chirola/shared";
import { calculateAmounts } from "../arca/wsfe/iva-calculator";

const UNDESCRIBED = "";

@Injectable()
export class DraftAmountsService {
  calculate(input: DraftAmountsInput): DraftAmounts {
    const amounts = calculateAmounts(
      input.voucherType,
      input.items.map((item) => ({ ...item, description: UNDESCRIBED })),
      input.tributes.map((tribute) => ({ ...tribute, description: UNDESCRIBED })),
    );
    return {
      netAmount: amounts.netAmount,
      ivaAmount: amounts.ivaAmount,
      exemptAmount: amounts.exemptAmount,
      untaxedAmount: amounts.untaxedAmount,
      tributeAmount: amounts.tributeAmount,
      totalAmount: amounts.totalAmount,
    };
  }
}
