// app/api/admin/sets/[id]/products/route.ts
//
// POST — adds one product (e.g. "Hobby Box") to a set's product catalog
// (SetProduct). This is what populates the "Which Product" dropdown in the
// Log a Gel form for this set — empty by default, the admin adds entries
// here manually.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";
import { PRODUCT_TYPE_OPTIONS, getProductLabel } from "@/lib/productTypes";

const VALID_VALUES = new Set(PRODUCT_TYPE_OPTIONS.map((o) => o.value));

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: setId } = await params;

  const cardSet = await prisma.cardSet.findUnique({ where: { id: setId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const productType = body?.productType;
  const productTypeOther =
    typeof body?.productTypeOther === "string" ? body.productTypeOther.trim() : "";

  if (typeof productType !== "string" || !VALID_VALUES.has(productType)) {
    return NextResponse.json({ error: "Please select a valid product type" }, { status: 400 });
  }
  if (productType === "OTHER" && !productTypeOther) {
    return NextResponse.json(
      { error: "Please enter a label for this \"Other\" product" },
      { status: 400 }
    );
  }

  // Block an exact duplicate — same product type, and (for "Other") the
  // same custom label. Multiple "Other" entries with different labels are
  // fine (e.g. two different store-exclusive boxes).
  const validatedType = productType as ProductType;

  const existing = await prisma.setProduct.findFirst({
    where: {
      cardSetId: setId,
      productType: validatedType,
      productTypeOther: validatedType === "OTHER" ? productTypeOther : null,
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This product is already in this set's catalog" },
      { status: 409 }
    );
  }

  const created = await prisma.setProduct.create({
    data: {
      cardSetId: setId,
      productType: validatedType,
      productTypeOther: validatedType === "OTHER" ? productTypeOther : null,
    },
  });

  // Shaped the same way getAdminChecklistForSet() returns existing products
  // — the raw Prisma row has no `label`, which is why a freshly-added row
  // showed a blank "Product" cell until the next full page load.
  const product = {
    id:               created.id,
    productType:      String(created.productType),
    productTypeOther: created.productTypeOther,
    label:            getProductLabel(String(created.productType), created.productTypeOther),
  };

  return NextResponse.json({ product });
}
