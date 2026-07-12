import { Injectable } from '@nestjs/common';
import { isCreditNote, voucherLetter } from '@chirola/shared';
import { PrismaService } from '../prisma/prisma.service';

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

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class IvaPositionService {
  constructor(private readonly prisma: PrismaService) {}

  async getMonthlyPosition(
    issuerId: string,
    year: number,
    month: number,
  ): Promise<IvaPosition> {
    const from = new Date(Date.UTC(year, month - 1, 1));
    const to = new Date(Date.UTC(year, month, 1));

    const debitByRate = await this.computeDebit(issuerId, from, to);
    const creditByRate = await this.computeCredit(issuerId, from, to);

    const rates = [...new Set([...debitByRate.keys(), ...creditByRate.keys()])].sort(
      (a, b) => b - a,
    );

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

  private async computeDebit(
    issuerId: string,
    from: Date,
    to: Date,
  ): Promise<Map<number, number>> {
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        issuerId,
        status: 'AUTORIZADO',
        voucherDate: { gte: from, lt: to },
      },
      include: { items: true },
    });

    const debitByRate = new Map<number, number>();
    for (const voucher of vouchers) {
      const letter = voucherLetter(voucher.voucherType);
      if (letter !== 'A' && letter !== 'B') {
        continue;
      }
      const sign = isCreditNote(voucher.voucherType) ? -1 : 1;
      for (const item of voucher.items) {
        const rate = Number(item.ivaRate);
        if (rate === 0) {
          continue;
        }
        const gross = Number(item.subtotal);
        const iva = gross - gross / (1 + rate / 100);
        debitByRate.set(rate, (debitByRate.get(rate) ?? 0) + sign * iva);
      }
    }
    return debitByRate;
  }

  private async computeCredit(
    issuerId: string,
    from: Date,
    to: Date,
  ): Promise<Map<number, number>> {
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
      add(RATE_21, Number(purchase.iva21));
      add(RATE_105, Number(purchase.iva105));
      add(RATE_27, Number(purchase.iva27));
    }
    return creditByRate;
  }
}
