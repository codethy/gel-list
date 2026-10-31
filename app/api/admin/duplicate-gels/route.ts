// app/api/admin/duplicate-gels/route.ts
//
// GET — every filed DuplicateGelFile. Admin-only (see lib/admin.ts). Used
// by AdminDuplicateGelsClient to refetch after an edited gel's fields
// change via AdminEditGelModal — same "just refetch" pattern as
// app/api/admin/gels/route.ts.

import { NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getAllDuplicateFiles } from "@/lib/data/adminDuplicateGels";

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const files = await getAllDuplicateFiles();
  return NextResponse.json({ files });
}
