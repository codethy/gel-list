// prisma/set-image.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sets (or replaces) the banner image for one CardSet. This is a developer-only
// tool — there is no in-app upload control, by design (see SetHeader.tsx).
//
// The image is uploaded to UploadThing — the same storage every other image
// in this app uses (gel photos, profile pictures, checklist-card images) —
// and only the resulting URL is stored in CardSet.imageUrl. This used to
// embed the image directly as a base64 data URL in the database instead,
// which meant every query that listed sets (the home page, category pages,
// the search dropdown, admin search) pulled the full image bytes through
// the Postgres connection every time, even to render a 40x40 thumbnail —
// see prisma/backfill-set-images.ts for the one-time migration of sets that
// already had a base64 image.
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/set-image.ts <setId> <path-to-image-file>
//
// Example:
//   npx tsx prisma/set-image.ts cly1a2b3c4d5 ~/Downloads/graphite-tennis.jpg
//
// Find a set's id by opening it in the app — the URL is /sets/<setId> — or by
// querying it: npx prisma studio, or SELECT id, name FROM "CardSet";
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "fs";
import { extname }      from "path";
import { Pool }          from "pg";
import { PrismaPg }      from "@prisma/adapter-pg";
import { PrismaClient }  from "@prisma/client";
import { UTApi }         from "uploadthing/server";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found.");
  console.error("   Make sure .env.local exists at the project root and contains");
  console.error('   DATABASE_URL="postgresql://..."\n');
  process.exit(1);
}
if (!process.env.UPLOADTHING_TOKEN) {
  console.error("\n❌ ERROR: UPLOADTHING_TOKEN was not found in .env.local.\n");
  process.exit(1);
}

const [, , setId, imagePath] = process.argv;

if (!setId || !imagePath) {
  console.error("\n❌ Usage: npx tsx prisma/set-image.ts <setId> <path-to-image-file>\n");
  process.exit(1);
}

const MIME_BY_EXT: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
};

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);
const utapi   = new UTApi();

async function main() {
  const ext  = extname(imagePath).toLowerCase();
  const mime = MIME_BY_EXT[ext];

  if (!mime) {
    console.error(`\n❌ Unsupported image type "${ext}". Use one of: ${Object.keys(MIME_BY_EXT).join(", ")}\n`);
    process.exit(1);
  }

  const set = await prisma.cardSet.findUnique({
    where:  { id: setId },
    select: { id: true, name: true },
  });

  if (!set) {
    console.error(`\n❌ No CardSet found with id "${setId}".\n`);
    process.exit(1);
  }

  console.log(`\n🔍 Found set: ${set.name}`);
  console.log(`📷 Reading image from ${imagePath}...`);

  const bytes = readFileSync(imagePath);
  const file  = new File([new Uint8Array(bytes)], `set-${setId}${ext}`, { type: mime });

  console.log(`⬆️  Uploading to UploadThing (${(bytes.length / 1024).toFixed(1)} KB)...`);
  const result = await utapi.uploadFiles(file);

  if (result.error) {
    console.error(`\n❌ Upload failed: ${result.error.message}\n`);
    process.exit(1);
  }

  await prisma.cardSet.update({
    where: { id: setId },
    data:  { imageUrl: result.data.ufsUrl },
  });

  console.log(`✅ Set image updated for "${set.name}": ${result.data.ufsUrl}\n`);
}

main()
  .catch((e) => {
    console.error("\n💥 The script encountered an error:\n");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
