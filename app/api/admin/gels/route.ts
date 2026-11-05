// app/api/admin/gels/route.ts
//
// GET — one page of the Gel Review Queue (see components/admin/
// AdminGelsClient.tsx) — a flat, oldest-first list split by verification
// status, searchable by card name/number or set name. Admin-only (see
// lib/admin.ts).
//
// Query params: status ("UNVERIFIED" | "VERIFIED", default "UNVERIFIED"),
// search (optional), page (default 1).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getReviewQueueGels } from "@/lib/data/adminGels";

export async function GET(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") === "VERIFIED" ? "VERIFIED" : "UNVERIFIED";
  const search = searchParams.get("search")?.trim() || undefined;
  const page   = Number(searchParams.get("page")) || 1;

  const result = await getReviewQueueGels({ status, search, page });
  return NextResponse.json(result);
}
