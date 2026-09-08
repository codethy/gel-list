/**
 * prisma/clear-test-data.ts
 *
 * Deletes ALL test/seed data from the database.
 * Safe to run — does NOT touch User, Account, or Session data.
 * Deletes in the correct order to respect foreign key constraints.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/clear-test-data.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// ── Load environment variables from .env.local ──────────────────────────────
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function clearTestData() {
  console.log("🚨 Starting test data cleanup...\n");

  // ── Step 1: Delete CardTemplateLike first (references CardTemplate + User)
  const deletedLikes = await prisma.cardTemplateLike.deleteMany({});
  console.log(`✅ Deleted ${deletedLikes.count} CardTemplateLike records`);

  // ── Step 2: Delete CardTransfer (references CardTemplate + PortfolioCard + User)
  const deletedTransfers = await prisma.cardTransfer.deleteMany({});
  console.log(`✅ Deleted ${deletedTransfers.count} CardTransfer records`);

  // ── Step 3: Delete UnverifiedHit (references CardTemplate + User)
  const deletedHits = await prisma.unverifiedHit.deleteMany({});
  console.log(`✅ Deleted ${deletedHits.count} UnverifiedHit records`);

  // ── Step 4: Delete PortfolioCard (references CardTemplate + CardSet + User + RipSession)
  const deletedPortfolioCards = await prisma.portfolioCard.deleteMany({});
  console.log(`✅ Deleted ${deletedPortfolioCards.count} PortfolioCard records`);

  // ── Step 5: Delete RipSession (references CardSet + User)
  const deletedRipSessions = await prisma.ripSession.deleteMany({});
  console.log(`✅ Deleted ${deletedRipSessions.count} RipSession records`);

  // ── Step 6: Delete ChecklistCard (references CardSet)
  const deletedChecklistCards = await prisma.checklistCard.deleteMany({});
  console.log(`✅ Deleted ${deletedChecklistCards.count} ChecklistCard records`);

  // ── Step 7: Delete CardTemplate (references CardSet)
  const deletedCardTemplates = await prisma.cardTemplate.deleteMany({});
  console.log(`✅ Deleted ${deletedCardTemplates.count} CardTemplate records`);

  // ── Step 8: Delete CardSet (no more dependents)
  const deletedCardSets = await prisma.cardSet.deleteMany({});
  console.log(`✅ Deleted ${deletedCardSets.count} CardSet records`);

  console.log("\n🎉 All test data cleared successfully!");
  console.log("ℹ️  User, Account, and Session data was NOT touched.\n");
}

clearTestData()
  .catch((e) => {
    console.error("❌ Error during cleanup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
