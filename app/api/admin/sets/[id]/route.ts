// app/api/admin/sets/[id]/route.ts
//
// PATCH — edits a CardSet's own name/year/brand/category/subcategory/
// description. Separate from the checklist-row routes alongside it, which
// edit individual ChecklistCard rows, not the set itself.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Category } from "@prisma/client";
import { resolveSubCategory, SUBCATEGORY_TO_CATEGORY } from "@/lib/taxonomy";

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId } = await params;

  const existing = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);

  const name  = parseString(body?.name);
  const brand = parseString(body?.brand);
  const year  = Number(body?.year);

  if (!name)  return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!brand) return NextResponse.json({ error: "Brand is required" }, { status: 400 });
  if (!Number.isFinite(year) || year < 1900 || year > 2100) {
    return NextResponse.json({ error: "Year must be a valid 4-digit year" }, { status: 400 });
  }

  const rawCategory = typeof body?.category === "string" ? body.category.toUpperCase() : "";
  if (!(Object.values(Category) as string[]).includes(rawCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  const category = rawCategory as Category;

  const rawSubCategory = typeof body?.subCategory === "string" ? body.subCategory : "";
  const { valid: subCategory, error: subCategoryError } = resolveSubCategory(rawSubCategory);
  if (!subCategory) {
    return NextResponse.json({ error: subCategoryError ?? "Invalid subcategory" }, { status: 400 });
  }
  if (SUBCATEGORY_TO_CATEGORY[subCategory] !== category) {
    return NextResponse.json({ error: "That subcategory doesn't belong to the selected category" }, { status: 400 });
  }

  const description = parseString(body?.description);

  const set = await prisma.cardSet.update({
    where: { id: setId },
    data:  { name, brand, year, category, subCategory, description },
    select: { id: true, name: true, year: true, brand: true, category: true, subCategory: true, description: true },
  });

  return NextResponse.json({
    set: { ...set, category: String(set.category) },
  });
}
