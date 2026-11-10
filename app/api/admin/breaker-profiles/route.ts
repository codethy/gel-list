// app/api/admin/breaker-profiles/route.ts
//
// GET  — list all breaker profiles.
// POST — create a new breaker profile. Body: { name, country,
//        isOfficialToppsPartner }. All three must be filled in before
//        creation; name must be unique (409 on a duplicate).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import {
  listBreakerProfiles,
  createBreakerProfile,
  BreakerProfileNameTakenError,
} from "@/lib/data/breakerProfiles";

export async function GET() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profiles = await listBreakerProfiles();
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    const profile = await createBreakerProfile({ name, country, isOfficialToppsPartner });
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof BreakerProfileNameTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
