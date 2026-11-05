// app/api/admin/about/[id]/route.ts
//
// PATCH  — edit a section's heading/body. Body: { heading?: string | null, body?: string }.
// DELETE — remove a section outright.
//
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { updateAboutUsSection, deleteAboutUsSection } from "@/lib/data/aboutUs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.aboutUsSection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: { heading?: string | null; body?: string } = {};
  if ("heading" in body) {
    data.heading = typeof body.heading === "string" && body.heading.trim() ? body.heading : null;
  }
  if ("body" in body) {
    if (typeof body.body !== "string" || !body.body.trim()) {
      return NextResponse.json({ error: "Copy is required" }, { status: 400 });
    }
    data.body = body.body;
  }

  const section = await updateAboutUsSection(id, data);
  return NextResponse.json({ section });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const existing = await prisma.aboutUsSection.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Section not found" }, { status: 404 });
  }

  await deleteAboutUsSection(id);
  return NextResponse.json({ success: true });
}
