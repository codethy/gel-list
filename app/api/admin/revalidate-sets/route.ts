// app/api/admin/revalidate-sets/route.ts
//
// POST — invalidates the /categories/[category] overview cache and the home
// page's featured-sets cache (see revalidateCategoryCaches in
// lib/data/homepage.ts). Every other /admin route checks an admin session
// cookie (see lib/admin.ts), but the two callers of this one —
// prisma/import-checklist.ts and prisma/create-set.ts — are plain CLI
// scripts with no session, run by hand against the same database. They
// authenticate instead with NEXTAUTH_SECRET as a bearer token, which they
// already have direct access to via .env.local.

import { NextRequest, NextResponse } from "next/server";
import { revalidateCategoryCaches } from "@/lib/data/homepage";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.NEXTAUTH_SECRET || auth !== `Bearer ${process.env.NEXTAUTH_SECRET}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  revalidateCategoryCaches();
  return NextResponse.json({ ok: true });
}
