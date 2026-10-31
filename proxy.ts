// proxy.ts
//
// Next.js 16 renamed `middleware.ts` to `proxy.ts` (the exported function
// is now `proxy`, not `middleware`) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
//
// This file's only job right now is a basic rate limit on mutation
// requests (POST/PATCH/PUT/DELETE) under /api/** — gel creation, likes,
// admin actions, favorites, product openings, etc. GET requests are left
// alone entirely, so normal browsing/pagination is never throttled.
//
// Proxy defaults to the Node.js runtime in this Next.js version (unlike
// older Next's Edge-by-default Middleware), so it's safe to use the real
// `lib/prisma` singleton (backed by `pg`) directly here rather than
// needing an edge-compatible driver.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 30;

function getClientIp(request: NextRequest): string {
  // Vercel (and most reverse proxies) set x-forwarded-for as
  // "client, proxy1, proxy2..." — the first entry is the original client.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function proxy(request: NextRequest) {
  if (!MUTATION_METHODS.has(request.method)) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);
  const { allowed, retryAfterSeconds } = await checkRateLimit(
    `mutation:${ip}`,
    LIMIT_PER_WINDOW,
    WINDOW_MS
  );

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
