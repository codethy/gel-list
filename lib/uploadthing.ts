// lib/uploadthing.ts
//
// Client-side hook for uploading card photos directly to UploadThing's
// storage — see app/api/uploadthing/core.ts for why this replaced the old
// base64-in-the-request-body approach.

import { generateReactHelpers } from "@uploadthing/react";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

export const { useUploadThing } = generateReactHelpers<OurFileRouter>();
