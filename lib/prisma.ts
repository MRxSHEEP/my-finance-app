import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js dev-mode hot-reload creates a fresh module scope per reload,
// which would otherwise spin up a new PrismaClient — and a new Postgres
// connection pool — on every edit. Caching the client on globalThis
// survives hot reloads within the same process, avoiding pool exhaustion
// against the hosted database's connection limit.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 requires an explicit driver adapter rather than reading the
// connection string from schema.prisma directly.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
