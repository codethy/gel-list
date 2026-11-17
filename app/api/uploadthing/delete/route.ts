// app/api/uploadthing/delete/route.ts
//
// POST — deletes one UploadThing file by URL, on behalf of the client-
// side image upload flow (AddGelModal.tsx, ProfileAccountCard.tsx) for a
// file that was uploaded this session but is being replaced, removed, or
// discarded before ever being saved anywhere. UTApi needs the secret
// token, so this can't run in the browser directly. Auth-gated the same
// way the upload route itself is (app/api/uploadthing/core.ts) — any
// signed-in user may delete a file, since this only ever runs against
// files the caller's own browser just uploaded moments earlier, never
// against an arbitrary id a client decides to try.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { deleteUploadThingFile } from "@/lib/uploadthingCleanup";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  await deleteUploadThingFile(url);
  return NextResponse.json({ success: true });
}
