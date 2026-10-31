// lib/rateLimit.ts
//
// Postgres-backed fixed-window rate limiter — used by proxy.ts to put a
// basic abuse ceiling on mutation routes (gel creation, likes, admin
// actions, etc). Backed by the shared Neon database (see RateLimitCounter
// in prisma/schema.prisma) rather than an in-memory Map or a new external
// service (Redis/Upstash), since a plain counter table is consistent with
// how every other piece of state in this app is stored, and — unlike an
// in-memory Map — stays correct across every serverless instance rather
// than being a soft, per-instance-only deterrent.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface RateLimitResult {
  allowed: boolean;
  // Seconds until the current window resets — only meaningful when !allowed.
  retryAfterSeconds: number;
}

// One query, atomic under concurrent requests via Postgres's own
// INSERT ... ON CONFLICT handling (no read-then-write race): increments
// the counter for `key` if it's still within the current fixed window, or
// resets it to 1 if the stored window has rolled over.
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
    INSERT INTO "RateLimitCounter" ("key", "windowStart", "count")
    VALUES (${key}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitCounter"."windowStart" = ${windowStart} THEN "RateLimitCounter"."count" + 1
        ELSE 1
      END,
      "windowStart" = ${windowStart}
    RETURNING "count"
  `);

  const count = rows[0]?.count ?? 1;
  const windowEndsAt = windowStart.getTime() + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((windowEndsAt - now) / 1000));

  // Opportunistic cleanup — on roughly 1 in 50 requests, delete rows from
  // long-expired windows so the table doesn't grow by one row per distinct
  // IP forever. Not load-bearing for correctness (an un-pruned row is
  // simply overwritten/reset next time that key's window rolls over), just
  // housekeeping, so it's fine to skip most of the time and never block
  // the actual rate-limit decision on it.
  if (Math.random() < 0.02) {
    const staleBefore = new Date(now - windowMs * 10);
    prisma.rateLimitCounter
      .deleteMany({ where: { windowStart: { lt: staleBefore } } })
      .catch(() => {});
  }

  return { allowed: count <= limit, retryAfterSeconds };
}
