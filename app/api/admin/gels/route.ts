// app/api/admin/gels/route.ts
//
// GET — every logged gel across the whole platform, grouped by set then by
// My Own Gel / Someone Else's Gel. Admin-only (see lib/admin.ts).

import { NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getAllLoggedGelsGrouped } from "@/lib/data/adminGels";

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groups = await getAllLoggedGelsGrouped();
  return NextResponse.json({ groups });
}
