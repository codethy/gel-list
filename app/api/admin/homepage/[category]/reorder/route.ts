// app/api/admin/homepage/[category]/reorder/route.ts
//
// PATCH — persist a new display order for this category's featured sets.
// Body: { orderedCardSetIds: string[] } — every currently-featured set's id,
// in the desired order. Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { Category } from "@prisma/client";
import { getFeaturedSetsForAdmin, reorderFeaturedSets } from "@/lib/data/homepage";

function parseCategory(raw: string): Category | null {
  const upper = raw.toUpperCase();
  return (Object.values(Category) as string[]).includes(upper) ? (upper as Category) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { category: rawCategory } = await params;
  const category = parseCategory(rawCategory);
  if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const orderedCardSetIds = Array.isArray(body?.orderedCardSetIds) ? body.orderedCardSetIds : null;
  if (!orderedCardSetIds) {
    return NextResponse.json({ error: "orderedCardSetIds is required" }, { status: 400 });
  }

  await reorderFeaturedSets(category, orderedCardSetIds);

  const featured = await getFeaturedSetsForAdmin(category);
  return NextResponse.json({ featured });
}
