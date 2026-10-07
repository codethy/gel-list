// lib/admin.ts
//
// Shared "is this request from the developer?" check for everything under
// /admin — the page itself and its API routes. There's no in-app way to
// become an admin; see prisma/make-admin.ts.

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function getAdminUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where:  { email: session.user.email },
    select: { id: true, isAdmin: true },
  });

  return user?.isAdmin ? user.id : null;
}
