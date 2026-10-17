// app/api/uploadthing/core.ts
//
// Replaces the old approach of embedding card photos as base64 text
// directly inside gel-creation API requests. That broke in production:
// Vercel rejects any serverless function request body over 4.5MB, and a
// base64-encoded phone photo blows past that easily — it worked only on
// localhost, which has no such limit. Uploading here instead means the
// actual image bytes never touch our own API route; the client uploads
// straight to UploadThing's storage and our API only ever receives a
// short URL string.

import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const f = createUploadthing();

export const ourFileRouter = {
  cardImage: f({ image: { maxFileSize: "16MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        throw new UploadThingError("Unauthorized");
      }
      return { userId: session.user.id };
    })
    .onUploadComplete(async ({ metadata }) => {
      return { uploadedBy: metadata.userId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
