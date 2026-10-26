// prisma/backfill-set-images.ts
// ─────────────────────────────────────────────────────────────────────────────
// One-time migration: every CardSet.imageUrl that's still a base64 data URL
// (the old storage method — see the history in prisma/set-image.ts) gets its
// image re-uploaded to UploadThing, and the column replaced with the
// resulting short URL. Safe to re-run — it only ever touches rows whose
// imageUrl still starts with "data:", so already-migrated rows are skipped.
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/backfill-set-images.ts
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Pool }         from "pg";
import { PrismaPg }     from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { UTApi }        from "uploadthing/server";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found in .env.local.\n");
  process.exit(1);
}
if (!process.env.UPLOADTHING_TOKEN) {
  console.error("\n❌ ERROR: UPLOADTHING_TOKEN was not found in .env.local.\n");
  process.exit(1);
}

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);
const utapi   = new UTApi();

// "data:image/png;base64,AAAA..." -> { mime: "image/png", ext: "png", buffer }
function parseDataUrl(dataUrl: string): { mime: string; ext: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1];
  const ext  = mime.split("/")[1] ?? "bin";
  return { mime, ext, buffer: Buffer.from(match[2], "base64") };
}

async function main() {
  const sets = await prisma.cardSet.findMany({
    where:  { imageUrl: { startsWith: "data:" } },
    select: { id: true, name: true, imageUrl: true },
  });

  if (sets.length === 0) {
    console.log("\n✅ Nothing to migrate — no CardSet has a base64 imageUrl.\n");
    return;
  }

  console.log(`\nFound ${sets.length} set(s) with a base64 imageUrl to migrate.\n`);

  let migrated = 0;
  let failed   = 0;

  for (const set of sets) {
    const parsed = parseDataUrl(set.imageUrl!);
    if (!parsed) {
      console.error(`⚠️  Skipping "${set.name}" — imageUrl doesn't look like a data URL.`);
      failed++;
      continue;
    }

    const sizeKb = (parsed.buffer.length / 1024).toFixed(1);
    process.stdout.write(`⬆️  ${set.name} (${sizeKb} KB)... `);

    try {
      const file = new File([new Uint8Array(parsed.buffer)], `set-${set.id}.${parsed.ext}`, { type: parsed.mime });
      const result = await utapi.uploadFiles(file);

      if (result.error) {
        console.log(`❌ upload failed: ${result.error.message}`);
        failed++;
        continue;
      }

      await prisma.cardSet.update({
        where: { id: set.id },
        data:  { imageUrl: result.data.ufsUrl },
      });

      console.log(`✅ ${result.data.ufsUrl}`);
      migrated++;
    } catch (err) {
      console.log(`❌ ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Migrated: ${migrated}   Failed: ${failed}`);
  console.log("═".repeat(60) + "\n");
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
