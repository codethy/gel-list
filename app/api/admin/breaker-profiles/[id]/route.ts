// app/api/admin/breaker-profiles/[id]/route.ts
//
// PATCH  — edit a breaker profile's name/country/partner flag.
// DELETE — remove a breaker profile. Its BreakerProductOpening history is
//          cascaded (meaningless without the profile); any PortfolioCard
//          linked to it is only unlinked (breakerProfileId -> null), never
//          deleted — see onDelete choices in prisma/schema.prisma.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import {
  updateBreakerProfile,
  deleteBreakerProfile,
  BreakerProfileNameTakenError,
} from "@/lib/data/breakerProfiles";

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
  const name    = typeof body?.name === "string" ? body.name.trim() : "";
  const country = typeof body?.country === "string" ? body.country.trim() : "";
  const isOfficialToppsPartner = body?.isOfficialToppsPartner === true;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!country) {
    return NextResponse.json({ error: "Country is required" }, { status: 400 });
  }

  try {
    const profile = await updateBreakerProfile(id, { name, country, isOfficialToppsPartner });
    if (!profile) {
      return NextResponse.json({ error: "Breaker profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof BreakerProfileNameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
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
  const deleted = await deleteBreakerProfile(id);
  if (!deleted) {
    return NextResponse.json({ error: "Breaker profile not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
