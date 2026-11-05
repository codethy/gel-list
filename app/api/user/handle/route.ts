// app/api/user/handle/route.ts
//
// PATCH /api/user/handle
// Lets an ADMIN change their own @handle (see Profile page). Handles are
// auto-generated at first sign-in (app/api/auth/[...nextauth]/route.ts's
// createUser event) and are not meant to be user-chosen — regular users
// get no handle-editing UI at all (see ProfileAccountCard.tsx's `isAdmin`
// prop); this route enforces that server-side too, since the UI gate
// alone isn't a security boundary.
//
// Body: { handle: string }

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

export async function PATCH(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rawHandle = typeof body?.handle === "string" ? body.handle.trim() : "";

  if (!rawHandle) {
    return NextResponse.json({ error: "Handle is required" }, { status: 400 });
  }
  if (rawHandle.length < HANDLE_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Handle must be at least ${HANDLE_MIN_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (rawHandle.length > HANDLE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Handle must be ${HANDLE_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }
  if (!HANDLE_PATTERN.test(rawHandle)) {
    return NextResponse.json(
      { error: "Handle can only contain lowercase letters, numbers, and underscores" },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.update({
      where: { id: adminUserId },
      data: { handle: rawHandle },
      select: { handle: true },
    });
    return NextResponse.json({ handle: user.handle });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "This handle is already taken" }, { status: 409 });
    }
    throw err;
  }
}
