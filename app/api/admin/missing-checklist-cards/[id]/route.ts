// app/api/admin/missing-checklist-cards/[id]/route.ts
//
// PATCH  — toggle isResolved: { isResolved: boolean }. Marking resolved
//          means the real ChecklistCard row(s) have since been added;
//          this entry stays as a record of it rather than being deleted.
// DELETE — removes the backlog entry outright (e.g. added by mistake).
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { setMissingChecklistCardResolved, deleteMissingChecklistCard } from "@/lib/data/missingChecklistCards";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const isResolved = Boolean(body?.isResolved);

  const card = await setMissingChecklistCardResolved(id, isResolved);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ card });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const removed = await deleteMissingChecklistCard(id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
