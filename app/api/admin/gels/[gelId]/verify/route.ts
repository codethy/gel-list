// app/api/admin/gels/[gelId]/verify/route.ts
//
// POST — the developer's "Verified" / "False" decision on one logged gel.
// Admin-only (see lib/admin.ts).
//
// Body: { action: "VERIFY" | "FALSE" }
//   VERIFY — marks the gel verified. If this pushes the logging user past
//            AUTO_VERIFY_THRESHOLD total verified gels, they become a
//            "verified user" and all their future gels auto-verify (see
//            app/api/sets/[id]/gels/route.ts).
//   FALSE  — the gel isn't real/accurate; it's removed from the platform
//            entirely rather than just hidden.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AUTO_VERIFY_THRESHOLD } from "@/lib/data/adminGels";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ gelId: string }> }
) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { gelId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;
  if (action !== "VERIFY" && action !== "FALSE") {
    return NextResponse.json({ error: 'action must be "VERIFY" or "FALSE"' }, { status: 400 });
  }

  const gel = await prisma.portfolioCard.findUnique({
    where:  { id: gelId },
    select: { id: true, userId: true },
  });
  if (!gel) {
    return NextResponse.json({ error: "Gel not found" }, { status: 404 });
  }

  if (action === "FALSE") {
    try {
      await prisma.portfolioCard.delete({ where: { id: gelId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        return NextResponse.json(
          { error: "This gel has transfer history and can't be deleted." },
          { status: 409 }
        );
      }
      throw error;
    }
    return NextResponse.json({ success: true, deleted: true });
  }

  // action === "VERIFY"
  await prisma.portfolioCard.update({
    where: { id: gelId },
    data:  { isVerified: true },
  });

  const verifiedCount = await prisma.portfolioCard.count({
    where: { userId: gel.userId, isVerified: true },
  });

  let becameVerifiedUser = false;
  if (verifiedCount >= AUTO_VERIFY_THRESHOLD) {
    const updated = await prisma.user.updateMany({
      where: { id: gel.userId, isVerifiedUser: false },
      data:  { isVerifiedUser: true },
    });
    becameVerifiedUser = updated.count > 0;
  }

  return NextResponse.json({ success: true, isVerified: true, becameVerifiedUser });
}
