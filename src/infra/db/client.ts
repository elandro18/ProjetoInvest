import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma único por processo (ARCHITECTURE.md §8).
 *
 * Em desenvolvimento o `next dev` recarrega módulos; guardar a instância no
 * `globalThis` evita esgotar o pool de conexões a cada hot reload.
 */

const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalParaPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
