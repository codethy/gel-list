// app/api/notifications/unread-count/route.ts
//
// GET — lightweight unread count for the bell icon's badge dot, polled
// periodically (see components/NotificationBell.tsx) without fetching
// the full notification list every time.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUnreadNotificationCount } from "@/lib/data/notifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const count = await getUnreadNotificationCount(session.user.id);
  return NextResponse.json({ count });
}
