// app/api/admin/about/reorder/route.ts
//
// PATCH — persist a new display order for every About Us section.
// Body: { orderedIds: string[] } — every section's id, in the desired order.
//
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getAboutUsSections, reorderAboutUsSections } from "@/lib/data/aboutUs";

export async function PATCH(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds : null;
  if (!orderedIds) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  await reorderAboutUsSections(orderedIds);

  const sections = await getAboutUsSections();
  return NextResponse.json({ sections });
}
