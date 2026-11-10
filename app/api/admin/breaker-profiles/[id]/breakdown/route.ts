// app/api/admin/breaker-profiles/[id]/breakdown/route.ts
//
// GET — this breaker's attributed products-opened and gels-hit counts,
// nested category -> subcategory -> set (see lib/data/breakerProfiles.ts).

import { NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getBreakerBreakdown } from "@/lib/data/breakerProfiles";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const breakdown = await getBreakerBreakdown(id);
  return NextResponse.json(breakdown);
}
