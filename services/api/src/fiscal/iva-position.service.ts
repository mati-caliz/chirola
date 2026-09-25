import { Injectable } from "@nestjs/common";
import { authorizedVoucherStatuses, isCreditNote } from "@chirola/shared";
import { PrismaService } from "../prisma/prisma.service";
import { breakDownVoucherTaxes, round2, voucherSign } from "./voucher-tax-breakdown";

const RATE_21 = 21;
const RATE_105 = 10.5;
const RATE_27 = 27;

interface IvaRateBreakdown {
  rate: number;
  debit: number;
  credit: number;
  balance: number;
}

export interface IvaPosition {
  year: number;
  month: number;
  breakdown: IvaRateBreakdown[];
  totalDebit: number;
  totalCredit: number;
  balance: number;
}

@Injectable()
export class IvaPositionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyPosition(issuerId: string, year: number, month: number): Promise<IvaPosition> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const debitByRate = await this.computeDebit(issuerId, from, to);
    const creditByRate = await this.computeCredit(issuerId, from, to);

    const rates = [...new Set([...debitByRate.keys(), ...creditByRate.keys()])].sort((a, b) => b - a);

    const breakdown: IvaRateBreakdown[] = rates.map((rate) => {
      const debit = round2(debitByRate.get(rate) ?? 0);
      const credit = round2(creditByRate.get(rate) ?? 0);
      return { rate, debit, credit, balance: round2(debit - credit) };
    });

    const totalDebit = round2(breakdown.reduce((acc, row) => acc + row.debit, 0));
    const totalCredit = round2(breakdown.reduce((acc, row) => acc + row.credit, 0));

    return {
      year,
      month,
      breakdown,
      totalDebit,
      totalCredit,
      balance: round2(totalDebit - totalCredit),
    };
  }

  private async computeDebit(issuerId: string, from: Date, to: Date): Promise<Map<number, number>> {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        issuerId,
        status: { in: [...authorizedVoucherStatuses] },
        voucherDate: { gte: from, lt: to },
      },
      include: { items: true },
    });

    const debitByRate = new Map<number, number>();
    for (const voucher of vouchers) {
      const sign = voucherSign(voucher.voucherType);
      const { ivaByRate } = breakDownVoucherTaxes(voucher);
      for (const [rate, iva] of ivaByRate) {
        debitByRate.set(rate, (debitByRate.get(rate) ?? 0) + sign * iva);
      }
    }
    return debitByRate;
  }

  private async computeCredit(issuerId: string, from: Date, to: Date): Promise<Map<number, number>> {
    const purchases = await this.prisma.purchaseInvoice.findMany({
      where: { issuerId, issueDate: { gte: from, lt: to } },
    });

    const creditByRate = new Map<number, number>();
    const add = (rate: number, amount: number): void => {
      if (amount !== 0) {
        creditByRate.set(rate, (creditByRate.get(rate) ?? 0) + amount);
      }
    };
    for (const purchase of purchases) {
      const sign = isCreditNote(purchase.invoiceType) ? -1 : 1;
      add(RATE_21, sign * Number(purchase.iva21));
      add(RATE_105, sign * Number(purchase.iva105));
      add(RATE_27, sign * Number(purchase.iva27));
    }
    return creditByRate;
  }
}
