// app/api/admin/users/count/route.ts
//
// GET — total number of accounts ever created. Polled by the live counter
// at /admin/users (components/admin/AdminUserCountClient.tsx). Admin-only.

import { NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getUserCount } from "@/lib/data/adminUsers";

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const count = await getUserCount();
  return NextResponse.json({ count });
}
