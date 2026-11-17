// app/api/admin/eql-sets/route.ts
//
// GET  — list every set currently enrolled in the EQL Tracker.
// POST — enroll a new set. Body: { cardSetId, products: [{ productType,
//        productTypeOther, maxQuantity, estimatedPrintRun }] }. cardSetId
//        must not already be enrolled (409 on a duplicate); every product
//        needs a valid productType and a maxQuantity >= 1.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  listEqlSets,
  createEqlSet,
  EqlSetAlreadyExistsError,
  type EqlProductInput,
} from "@/lib/data/eqlTracker";

// Shared shape/validation for the `products` array sent by both POST here
// and PATCH at app/api/admin/eql-sets/[id]/route.ts.
export function parseProducts(body: unknown): EqlProductInput[] | string {
  const raw = (body as { products?: unknown })?.products;
  if (!Array.isArray(raw) || raw.length === 0) {
    return "At least one EQL option is required";
  }

  const products: EqlProductInput[] = [];
  for (const entry of raw) {
    const e = entry as Record<string, unknown>;
    const productType = typeof e?.productType === "string" ? e.productType : "";
    const productTypeOther = typeof e?.productTypeOther === "string" && e.productTypeOther.trim() ? e.productTypeOther.trim() : null;
    const maxQuantity = Number(e?.maxQuantity);
    const estimatedPrintRunRaw = e?.estimatedPrintRun;
    const estimatedPrintRun =
      estimatedPrintRunRaw === null || estimatedPrintRunRaw === undefined || estimatedPrintRunRaw === ""
        ? null
        : Number(estimatedPrintRunRaw);
    const boxesPerCaseRaw = e?.boxesPerCase;
    const boxesPerCase =
      boxesPerCaseRaw === null || boxesPerCaseRaw === undefined || boxesPerCaseRaw === ""
        ? null
        : Number(boxesPerCaseRaw);

    if (!productType) return "Every EQL option needs a product type";
    if (productType === "OTHER" && !productTypeOther) return "A custom label is required for \"Other\" products";
    if (!Number.isInteger(maxQuantity) || maxQuantity < 1) return "Max quantity must be a whole number of at least 1";
    if (estimatedPrintRun !== null && (!Number.isInteger(estimatedPrintRun) || estimatedPrintRun < 1)) {
      return "Estimated print run must be a positive whole number";
    }
    if (productType === "CASE" && (boxesPerCase === null || !Number.isInteger(boxesPerCase) || boxesPerCase < 1)) {
      return "Boxes per Hobby Case must be a positive whole number";
    }

    products.push({
      id: typeof e?.id === "string" ? e.id : undefined,
      productType,
      productTypeOther,
      maxQuantity,
      estimatedPrintRun,
      boxesPerCase,
    });
  }
  return products;
}

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sets = await listEqlSets();
  return NextResponse.json({ sets });
}

export async function POST(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const cardSetId = typeof body?.cardSetId === "string" ? body.cardSetId : "";
  if (!cardSetId) {
    return NextResponse.json({ error: "cardSetId is required" }, { status: 400 });
  }

  const cardSet = await prisma.cardSet.findUnique({ where: { id: cardSetId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const products = parseProducts(body);
  if (typeof products === "string") {
    return NextResponse.json({ error: products }, { status: 400 });
  }

  try {
    const set = await createEqlSet(cardSetId, products);
    return NextResponse.json({ set }, { status: 201 });
  } catch (error) {
    if (error instanceof EqlSetAlreadyExistsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
