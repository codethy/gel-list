// app/api/notifications/route.ts
//
// GET — the current user's latest notifications (see
// components/NotificationBell.tsx — no dedicated page, just this
// dropdown's data). Marks everything returned as read, since opening the
// dropdown is what "viewing" a notification means here.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getNotificationsForUser, markNotificationsRead } from "@/lib/data/notifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const notifications = await getNotificationsForUser(session.user.id);
  await markNotificationsRead(notifications.filter((n) => !n.isRead).map((n) => n.id));

  return NextResponse.json({ notifications });
}
