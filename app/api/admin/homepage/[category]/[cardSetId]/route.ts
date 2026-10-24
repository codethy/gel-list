// app/api/admin/homepage/[category]/[cardSetId]/route.ts
//
// DELETE — remove a set from this category's home page featured list.
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { Category } from "@prisma/client";
import { getFeaturedSetsForAdmin, removeFeaturedSet } from "@/lib/data/homepage";

function parseCategory(raw: string): Category | null {
  const upper = raw.toUpperCase();
  return (Object.values(Category) as string[]).includes(upper) ? (upper as Category) : null;
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ category: string; cardSetId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { category: rawCategory, cardSetId } = await params;
  const category = parseCategory(rawCategory);
  if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  await removeFeaturedSet(category, cardSetId);

  const featured = await getFeaturedSetsForAdmin(category);
  return NextResponse.json({ featured });
}
