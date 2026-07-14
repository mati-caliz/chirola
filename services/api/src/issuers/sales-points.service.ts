import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IssuersService } from './issuers.service';
import { ArcaParamsService } from './arca-params.service';

@Injectable()
export class SalesPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly issuers: IssuersService,
    private readonly params: ArcaParamsService,
  ) {}

  async list(userId: string, issuerId: string) {
    await this.issuers.getFromUser(issuerId, userId);
    return this.prisma.salesPoint.findMany({
      where: { issuerId },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, description: true },
    });
  }

  async sync(userId: string, issuerId: string) {
    const issuer = await this.issuers.getFromUser(issuerId, userId);
    const remote = await this.params.getSalesPoints(issuer);
    for (const point of remote) {
      await this.prisma.salesPoint.upsert({
        where: { issuerId_number: { issuerId, number: point.number } },
        create: { issuerId, number: point.number },
        update: {},
      });
    }
    return this.list(userId, issuerId);
  }

  async updateDescription(userId: string, issuerId: string, number: number, description: string) {
    await this.issuers.getFromUser(issuerId, userId);
    return this.prisma.salesPoint.update({
      where: { issuerId_number: { issuerId, number } },
      data: { description: description.length > 0 ? description : null },
      select: { id: true, number: true, description: true },
    });
  }
}
