// app/api/sets/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSetDetail } from "@/lib/data/sets";
import { prisma } from "@/lib/prisma";

// ── GET /api/sets/[id] ───────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where:  { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  const { id } = await params;
  const data = await getSetDetail(id, userId);

  if (!data) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
