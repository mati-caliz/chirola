import { PrismaService } from "./prisma.service";

export function prismaDouble(delegates: object): PrismaService {
  return Object.assign(new PrismaService(), delegates);
}
