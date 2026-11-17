// app/api/eql-sets/[id]/route.ts
//
// GET — one EQL set's public detail: name, banner image, its options
// (with maxQuantity/estimatedPrintRun), and both success/failed logs. No
// auth required — anyone can view an EQL drop's results.

import { NextResponse } from "next/server";
import { getEqlSetDetail } from "@/lib/data/eqlTracker";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getEqlSetDetail(id);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ detail });
}
