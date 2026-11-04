// app/api/user/bio/route.ts
//
// PATCH /api/user/bio
// Lets a signed-in user set/update their own Bio (see Profile page's
// ProfileAccountCard.tsx) — a short, free-text intro and/or social handles,
// up to 3 newline-separated lines.
//
// Body: { bio: string | null }  — null/empty clears the bio.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

const BIO_MAX_LENGTH = 300;
const BIO_MAX_LINES = 3;

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawBio = typeof body?.bio === "string" ? body.bio.trim() : "";

  if (rawBio.length > BIO_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Bio must be ${BIO_MAX_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }
  if (rawBio.split("\n").length > BIO_MAX_LINES) {
    return NextResponse.json(
      { error: `Bio can only have up to ${BIO_MAX_LINES} lines` },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { bio: rawBio || null },
    select: { bio: true },
  });
  return NextResponse.json({ bio: user.bio });
}
