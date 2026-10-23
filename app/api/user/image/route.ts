// app/api/user/image/route.ts
//
// PATCH /api/user/image
// Sets or clears the signed-in user's custom profile picture (User.profileImage).
// Clearing (passing null) reverts the displayed avatar back to whatever Google
// supplied at sign-in (User.image) — see ProfileAccountCard.tsx.
//
// Body: { profileImage: string | null }

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const profileImage = body?.profileImage;

  if (profileImage !== null && typeof profileImage !== "string") {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }
  if (typeof profileImage === "string" && !/^https:\/\//.test(profileImage)) {
    return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { profileImage },
    select: { profileImage: true },
  });

  return NextResponse.json({ profileImage: user.profileImage });
}
