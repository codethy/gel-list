// app/api/admin/homepage/[category]/route.ts
//
// GET  — the sets currently featured on the home page for this category, in
//        order.
// POST — add a set to this category's featured list. Body: { cardSetId }.
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { Category } from "@prisma/client";
import { getFeaturedSetsForAdmin, addFeaturedSet } from "@/lib/data/homepage";

function parseCategory(raw: string): Category | null {
  const upper = raw.toUpperCase();
  return (Object.values(Category) as string[]).includes(upper) ? (upper as Category) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { category: rawCategory } = await params;
  const category = parseCategory(rawCategory);
  if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const featured = await getFeaturedSetsForAdmin(category);
  return NextResponse.json({ featured });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ category: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { category: rawCategory } = await params;
  const category = parseCategory(rawCategory);
  if (!category) return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const cardSetId = typeof body?.cardSetId === "string" ? body.cardSetId : "";
  if (!cardSetId) return NextResponse.json({ error: "cardSetId is required" }, { status: 400 });

  const { error } = await addFeaturedSet(category, cardSetId);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const featured = await getFeaturedSetsForAdmin(category);
  return NextResponse.json({ featured });
}
