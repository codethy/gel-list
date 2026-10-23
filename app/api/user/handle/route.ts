// app/api/user/handle/route.ts
//
// PATCH /api/user/handle
// Lets a signed-in user change their own @handle (see Profile page). The
// handle is also what app/api/auth/[...nextauth]/route.ts auto-generates at
// first sign-in — this just lets the user override that initial value.
//
// Body: { handle: string }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 20;
const HANDLE_PATTERN = /^[a-z0-9_]+$/;

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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
      where: { id: session.user.id },
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
