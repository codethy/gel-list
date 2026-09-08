// prisma/create-set.ts
// ─────────────────────────────────────────────────────────────────────────────
// Creates the "2026 Topps Graphite Tennis" CardSet in your Neon database.
//
// This script mirrors your lib/prisma.ts connection pattern exactly:
//   Pool (pg) → PrismaPg adapter → PrismaClient
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/create-set.ts
// ─────────────────────────────────────────────────────────────────────────────

// ── IMPORTANT: Load .env FIRST — before any other imports ─────────────────────
// Next.js normally loads .env for you. Standalone scripts don't have that
// luxury, so we do it manually here with dotenv.
import { config } from "dotenv";
config({ path: ".env.local" });  // ← reads .env.local
config();

// ── Now import everything else ────────────────────────────────────────────────
import { Pool }                    from "pg";
import { PrismaPg }                from "@prisma/adapter-pg";
import { PrismaClient, Category }  from "@prisma/client";

// ── Safety check: make sure DATABASE_URL actually loaded ──────────────────────
if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found.");
  console.error("   Make sure your .env file exists at the root of your project");
  console.error("   and contains a line like:");
  console.error('   DATABASE_URL="postgresql://..."\n');
  process.exit(1);
}

// ── Set up the database connection — exact same pattern as lib/prisma.ts ──────
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔍 Checking if '2026 Topps Graphite Tennis' already exists...\n");

  // ── Check for duplicates before creating anything ─────────────────────────
  const existing = await prisma.cardSet.findFirst({
    where: {
      name:  "2026 Topps Graphite Tennis",
      year:  2026,
      brand: "Topps",
    },
  });

  if (existing) {
    // ── Already exists — just report the ID and exit cleanly ────────────────
    console.log("ℹ️  This CardSet already exists. Nothing was changed.\n");
    console.log("─".repeat(54));
    console.log(`  Name:        ${existing.name}`);
    console.log(`  ID:          ${existing.id}`);
    console.log(`  Category:    ${existing.category}`);
    console.log(`  SubCategory: ${existing.subCategory}`);
    console.log("─".repeat(54));
    console.log("\n📋 Copy the ID above and paste it into seed-checklist.ts\n");
    return;
  }

  // ── Doesn't exist yet — create it ─────────────────────────────────────────
  console.log("✨ CardSet not found. Creating it now...\n");

  const cardSet = await prisma.cardSet.create({
    data: {
      // ✅ Do NOT provide `id` — Prisma generates the cuid() automatically
      name:                 "2026 Topps Graphite Tennis",
      year:                 2026,
      brand:                "Topps",
      category:             Category.SPORTS,  // ← see NOTE below if this errors
      subCategory:          "Tennis",
      totalCardsInSet:      0,
      totalHitsInSet:       0,
      totalChaseCardsInSet: 0,
      // imageUrl and description are optional (String?) — omitted intentionally
    },
  });

  // ── Success — print everything clearly ────────────────────────────────────
  console.log("✅ CardSet created successfully!\n");
  console.log("─".repeat(54));
  console.log(`  Name:        ${cardSet.name}`);
  console.log(`  ID:          ${cardSet.id}`);
  console.log(`  Year:        ${cardSet.year}`);
  console.log(`  Brand:       ${cardSet.brand}`);
  console.log(`  Category:    ${cardSet.category}`);
  console.log(`  SubCategory: ${cardSet.subCategory}`);
  console.log("─".repeat(54));
  console.log("\n📋 NEXT STEP: Copy the ID value shown above.");
  console.log("   Open prisma/seed-checklist.ts and find this line:\n");
  console.log('     const CARD_SET_ID = "PASTE_YOUR_CARD_SET_ID_HERE";\n');
  console.log("   Replace PASTE_YOUR_CARD_SET_ID_HERE with your ID, like:\n");
  console.log(`     const CARD_SET_ID = "${cardSet.id}";\n`);
}

// ─── Run it ───────────────────────────────────────────────────────────────────
main()
  .catch((e) => {
    console.error("\n💥 The script encountered an error:\n");
    console.error(e);

    console.error("\n─── Common causes & fixes ───────────────────────────────");
    console.error(
      "\n❌  'Value SPORTS is not valid for enum'\n" +
      "    → Open prisma/schema.prisma and search for 'enum Category'\n" +
      "      to see all valid values. Then update line 55 of this script.\n" +
      "      For example: Category.SPORT  or  Category.TCG\n"
    );
    console.error(
      "❌  'SSL connection error' or 'connection refused'\n" +
      "    → Your DATABASE_URL may be wrong or missing '?sslmode=require'\n" +
      "      at the end. Check your .env file.\n"
    );
    console.error(
      "❌  'Unknown argument' error\n" +
      "    → A field name in the script doesn't match your schema.\n" +
      "      Paste the full error into the chat and it will be fixed.\n"
    );

    process.exit(1);
  })
  .finally(async () => {
    // ── Always close connections cleanly when the script finishes ────────────
    await prisma.$disconnect();
    await pool.end();
  });
