// app/api/admin/about/route.ts
//
// GET  — list every About Us section, in display order.
// POST — create a new section at the end. Body: { heading?: string | null, body: string }.
//
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { getAboutUsSections, createAboutUsSection } from "@/lib/data/aboutUs";

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sections = await getAboutUsSections();
  return NextResponse.json({ sections });
}

export async function POST(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const heading = typeof body.heading === "string" && body.heading.trim() ? body.heading : null;
  const sectionBody = typeof body.body === "string" ? body.body : "";

  if (!sectionBody.trim()) {
    return NextResponse.json({ error: "Copy is required" }, { status: 400 });
  }

  const section = await createAboutUsSection(heading, sectionBody);
  return NextResponse.json({ section }, { status: 201 });
}
