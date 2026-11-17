// prisma/cleanup-orphaned-uploads.ts
//
// Safety net for lib/uploadthingCleanup.ts's real-time hooks — finds every
// file in UploadThing storage that no column in the database references
// (User.profileImage, CardSet.imageUrl, PortfolioCard.cardFrontImageUrl/
// cardBackImageUrl, UnverifiedHit.cardFrontImageUrl/cardBackImageUrl,
// ChecklistCard.imageUrl) and deletes it. The real-time hooks should keep
// new orphans from accumulating day to day, but this catches whatever
// still slips through — a closed browser tab mid-upload, a dropped
// network request, anything from before those hooks existed.
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/cleanup-orphaned-uploads.ts            — report only
//   npx tsx prisma/cleanup-orphaned-uploads.ts --delete   — report AND delete
//
// Defaults to a dry run (unlike this repo's import scripts, which default
// to writing and opt OUT via --dry-run) — deleting a file is permanent in
// a way creating a database row isn't, so the safer default here is the
// other way around.

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Pool }         from "pg";
import { PrismaPg }     from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { UTApi }        from "uploadthing/server";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found. Make sure .env.local exists at the project root.\n");
  process.exit(1);
}
if (!process.env.UPLOADTHING_TOKEN) {
  console.error("\n❌ ERROR: UPLOADTHING_TOKEN was not found in .env.local.\n");
  process.exit(1);
}

const shouldDelete = process.argv.includes("--delete");

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);
const utapi   = new UTApi();

function extractKey(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(/\/f\/([^/?]+)/);
  return match ? match[1] : null;
}

async function main() {
  console.log(`\n  ORPHANED UPLOAD CLEANUP${shouldDelete ? "" : "  —  DRY RUN (nothing will be deleted)"}\n`);

  // ── Every file currently in storage ───────────────────────────────────
  const allFiles: { name: string; size: number; key: string; uploadedAt: number }[] = [];
  let offset = 0;
  const limit = 500;
  while (true) {
    const page = await utapi.listFiles({ limit, offset });
    allFiles.push(...page.files.map((f) => ({ name: f.name, size: f.size, key: f.key, uploadedAt: f.uploadedAt })));
    if (!page.hasMore) break;
    offset += limit;
  }
  console.log(`Files in storage: ${allFiles.length}`);

  // ── Every URL referenced anywhere in the database ─────────────────────
  const [users, cardSets, portfolioCards, unverifiedHits, checklistCards] = await Promise.all([
    prisma.user.findMany({ select: { profileImage: true } }),
    prisma.cardSet.findMany({ select: { imageUrl: true } }),
    prisma.portfolioCard.findMany({ select: { cardFrontImageUrl: true, cardBackImageUrl: true } }),
    prisma.unverifiedHit.findMany({ select: { cardFrontImageUrl: true, cardBackImageUrl: true } }),
    prisma.checklistCard.findMany({ select: { imageUrl: true } }),
  ]);

  const referencedKeys = new Set<string>();
  const addRef = (url: string | null) => { const k = extractKey(url); if (k) referencedKeys.add(k); };
  users.forEach((u) => addRef(u.profileImage));
  cardSets.forEach((c) => addRef(c.imageUrl));
  portfolioCards.forEach((p) => { addRef(p.cardFrontImageUrl); addRef(p.cardBackImageUrl); });
  unverifiedHits.forEach((h) => { addRef(h.cardFrontImageUrl); addRef(h.cardBackImageUrl); });
  checklistCards.forEach((c) => addRef(c.imageUrl));

  console.log(`Distinct keys referenced in the database: ${referencedKeys.size}`);

  // ── Diff ───────────────────────────────────────────────────────────────
  const orphans = allFiles.filter((f) => !referencedKeys.has(f.key));
  const orphanBytes = orphans.reduce((sum, f) => sum + f.size, 0);

  console.log(`\nOrphaned files: ${orphans.length}`);
  console.log(`Orphaned bytes: ${orphanBytes.toLocaleString()} (${(orphanBytes / 1024 / 1024).toFixed(2)} MB)`);

  if (orphans.length === 0) {
    console.log("\nNothing to clean up.\n");
    return;
  }

  const sorted = [...orphans].sort((a, b) => a.uploadedAt - b.uploadedAt);
  console.log("\nOldest 10:");
  for (const f of sorted.slice(0, 10)) {
    console.log(`  ${new Date(f.uploadedAt).toISOString()}  ${f.name}  (${(f.size / 1024).toFixed(0)} KB)`);
  }

  if (!shouldDelete) {
    console.log(`\nRe-run with --delete to actually remove these ${orphans.length} file(s).\n`);
    return;
  }

  const result = await utapi.deleteFiles(orphans.map((f) => f.key));
  console.log(`\n✅ Deleted ${result.deletedCount} file(s), freeing ${(orphanBytes / 1024 / 1024).toFixed(2)} MB.\n`);
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
