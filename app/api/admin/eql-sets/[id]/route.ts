// app/api/admin/eql-sets/[id]/route.ts
//
// GET    — full detail for the edit modal (raw productType/productTypeOther
//          per row, plus each row's own logged-result count).
// PATCH  — replace the product list. Body: { products: [...] }, same shape
//          as POST at app/api/admin/eql-sets/route.ts — rows carrying their
//          own `id` are updated in place, rows without one are created, and
//          existing rows omitted from the array are deleted (cascading any
//          EqlResult logged against them).
// DELETE — remove the whole EQL enrollment for this set.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getEqlSetAdminDetail, updateEqlSet, deleteEqlSet } from "@/lib/data/eqlTracker";
import { parseProducts } from "../route";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const detail = await getEqlSetAdminDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ detail });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const products = parseProducts(body);
  if (typeof products === "string") {
    return NextResponse.json({ error: products }, { status: 400 });
  }

  const set = await updateEqlSet(id, products);
  if (!set) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ set });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const deleted = await deleteEqlSet(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
