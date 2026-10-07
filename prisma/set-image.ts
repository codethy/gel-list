// prisma/set-image.ts
// ─────────────────────────────────────────────────────────────────────────────
// Sets (or replaces) the banner image for one CardSet. This is a developer-only
// tool — there is no in-app upload control, by design (see SetHeader.tsx).
//
// The image is stored the same way gel photos already are in this app: as a
// base64 data URL in the database, in CardSet.imageUrl.
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

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found.");
  console.error("   Make sure .env.local exists at the project root and contains");
  console.error('   DATABASE_URL="postgresql://..."\n');
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

  const bytes    = readFileSync(imagePath);
  const dataUrl  = `data:${mime};base64,${bytes.toString("base64")}`;

  await prisma.cardSet.update({
    where: { id: setId },
    data:  { imageUrl: dataUrl },
  });

  console.log(`✅ Set image updated for "${set.name}" (${(bytes.length / 1024).toFixed(1)} KB).\n`);
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
