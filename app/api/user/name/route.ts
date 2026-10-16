// app/api/user/name/route.ts
//
// POST /api/user/name
// Submits the required first-sign-in display name (see
// components/NameSetupModal.tsx). Sets hasCustomName so the prompt never
// shows again for this user. Names don't need to be unique — `handle`
// already disambiguates users who happen to share a name.
//
// Body: { name: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 30;
const NAME_PATTERN = /^[A-Za-z0-9 ]+$/;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawName = typeof body?.name === "string" ? body.name.trim() : "";

  if (!rawName) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (rawName.length < NAME_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Name must be at least ${NAME_MIN_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (rawName.length > NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Name must be ${NAME_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }
  if (!NAME_PATTERN.test(rawName)) {
    return NextResponse.json(
      { error: "Name can only contain letters, numbers, and spaces" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data:  { name: rawName, hasCustomName: true },
    select: { name: true },
  });

  return NextResponse.json({ name: user.name });
}
