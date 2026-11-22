// app/api/admin/gels/route.ts
//
// GET — one page of the Gel Review Queue (see components/admin/
// AdminGelsClient.tsx) — a flat, oldest-first list split by verification
// status, filterable by set, player/character name, variation name,
// parallel, print run, username, who pulled it, location, product, where
// it was bought, and notes.
// Admin-only (see lib/admin.ts).
//
// Query params: status ("UNVERIFIED" | "VERIFIED", default "UNVERIFIED"),
// page (default 1), and one per AdminGelFilters key below (all optional).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getReviewQueueGels, type AdminGelFilters } from "@/lib/data/adminGels";

const FILTER_PARAMS: (keyof AdminGelFilters)[] = [
  "setName", "playerName", "variationName", "parallel", "printRun",
  "username", "pulledBy", "location", "product", "purchaseLocation", "notes",
];

export async function GET(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") === "VERIFIED" ? "VERIFIED" : "UNVERIFIED";
  const page   = Number(searchParams.get("page")) || 1;

  const filters: AdminGelFilters = {};
  for (const key of FILTER_PARAMS) {
    const value = searchParams.get(key)?.trim();
    if (value) filters[key] = value;
  }

  const result = await getReviewQueueGels({ status, filters, page });
  return NextResponse.json(result);
}
