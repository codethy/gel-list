// prisma/backfill-breaker-attribution.ts
// ─────────────────────────────────────────────────────────────────────────────
// One-time migration: links already-logged gels to a BreakerProfile that was
// created BEFORE lib/data/breakerProfiles.ts's createBreakerProfile started
// doing this automatically at creation time. For every BreakerProfile, finds
// every PortfolioCard whose breakerName exactly matches that profile's name
// and isn't linked to any profile yet, and links it.
//
// Safe to re-run — it only ever touches rows with breakerProfileId: null, so
// an already-backfilled or manually-linked gel is never touched again, and a
// freshly-created profile (which already backfills itself on creation) is a
// no-op here too.
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/backfill-breaker-attribution.ts
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Pool }         from "pg";
import { PrismaPg }     from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found in .env.local.\n");
  process.exit(1);
}

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  const profiles = await prisma.breakerProfile.findMany({ select: { id: true, name: true } });
  console.log(`Found ${profiles.length} breaker profile(s).`);

  let totalLinked = 0;
  for (const profile of profiles) {
    const result = await prisma.portfolioCard.updateMany({
      where: { breakerName: profile.name, breakerProfileId: null },
      data:  { breakerProfileId: profile.id },
    });
    if (result.count > 0) {
      console.log(`  "${profile.name}": linked ${result.count} gel(s).`);
    }
    totalLinked += result.count;
  }

  console.log(`Done. Linked ${totalLinked} gel(s) total.`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
