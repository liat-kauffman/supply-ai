import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function hasRequiredDelegates(client: PrismaClient) {
  return (
    "receipt" in client &&
    "receiptLine" in client &&
    "aiWorkspaceMessage" in client
  );
}

const cachedPrisma = globalForPrisma.prisma;

if (cachedPrisma && !hasRequiredDelegates(cachedPrisma)) {
  void cachedPrisma.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function databaseHealth(): Promise<{
  ok: boolean;
  latencyMs: number;
}> {
  const startedAt = performance.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - startedAt) };
  }
}
