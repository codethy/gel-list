// app/api/sets/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getSetDetail } from "@/lib/data/sets";
import { CardType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// ── TYPE HELPERS ────────────────────────────────────────────────────────────

// A helper function that checks if a string is a valid CardType enum value.
// This prevents bad data from crashing your Prisma query.
function isValidCardType(value: string): value is CardType {
  return Object.values(CardType).includes(value as CardType);
}

// ── GET /api/sets/[id] ───────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
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

  const data = await getSetDetail(params.id, userId);

  if (!data) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
