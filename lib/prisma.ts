// lib/prisma.ts

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// ── Prisma 7 requires a database driver adapter ──────────────────────────────
// The connection URL can no longer be passed as datasourceUrl to PrismaClient.
// Instead, we create a pg connection pool and pass it via PrismaPg adapter.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL as string,
    // Neon's connection URL already points at its pooled (pgbouncer) endpoint
    // — this pool just needs enough connections for one serverless instance's
    // own concurrent requests, not the `pg` library's default of 10. A small
    // explicit max avoids each warm instance holding more idle connections
    // against the pooler than it actually needs.
    max: 5,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In development, reuse the same client across hot reloads to avoid
// exhausting the database connection pool.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
