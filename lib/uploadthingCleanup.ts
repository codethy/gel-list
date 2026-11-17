// lib/uploadthingCleanup.ts
//
// Deletes a file from UploadThing storage given one of our own stored URLs
// (https://<app>.ufs.sh/f/<key>) — the cleanup half of the upload flow in
// app/api/uploadthing/core.ts. UploadThing URLs are content-addressed:
// replacing or clearing an image never reuses the old key, so every place
// in the app that overwrites or clears one of these columns must call
// this on the value being superseded, or the old file sits in storage
// forever. Never throws — a cleanup failure should never block the
// user-facing mutation that triggered it; worst case the file is picked
// up later by prisma/cleanup-orphaned-uploads.ts.

import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

function extractKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/f\/([^/?]+)/);
  return match ? match[1] : null;
}

export async function deleteUploadThingFile(url: string | null | undefined): Promise<void> {
  const key = extractKey(url);
  if (!key) return;
  try {
    await utapi.deleteFiles([key]);
  } catch (error) {
    console.error("Failed to delete superseded UploadThing file", key, error);
  }
}

export async function deleteUploadThingFiles(urls: (string | null | undefined)[]): Promise<void> {
  const keys = urls.map(extractKey).filter((k): k is string => k !== null);
  if (keys.length === 0) return;
  try {
    await utapi.deleteFiles(keys);
  } catch (error) {
    console.error("Failed to delete superseded UploadThing files", keys, error);
  }
}

// The common "this column is being overwritten or cleared" case — a no-op
// when the value didn't actually change, or the old value was already
// empty, so callers can fire this unconditionally after every update
// without checking first.
export async function cleanupSupersededFile(
  previousUrl: string | null | undefined,
  nextUrl: string | null | undefined
): Promise<void> {
  if (!previousUrl || previousUrl === nextUrl) return;
  await deleteUploadThingFile(previousUrl);
}
