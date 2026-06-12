/**
 * Singleton Prisma client for Next.js.
 *
 * In development, Next.js hot-reload creates new module instances on each
 * file change, which would exhaust the PostgreSQL connection pool without
 * this singleton pattern. We attach the client to globalThis to survive HMR.
 *
 * In production, module caching means this file is only evaluated once per
 * worker process — the `global.prisma` guard is a no-op there.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
