// prisma/make-admin.ts
// ─────────────────────────────────────────────────────────────────────────────
// Grants (or revokes) access to /admin/gels for one user, by email. There is
// no in-app way to become an admin — this is the only way in.
//
// HOW TO RUN (from your project root):
//   npx tsx prisma/make-admin.ts you@example.com
//   npx tsx prisma/make-admin.ts you@example.com --revoke
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { Pool }          from "pg";
import { PrismaPg }      from "@prisma/adapter-pg";
import { PrismaClient }  from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error("\n❌ ERROR: DATABASE_URL was not found.\n");
  process.exit(1);
}

const [, , email, flag] = process.argv;
const revoke = flag === "--revoke";

if (!email) {
  console.error("\n❌ Usage: npx tsx prisma/make-admin.ts <email> [--revoke]\n");
  process.exit(1);
}

const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  const user = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, name: true, isAdmin: true },
  });

  if (!user) {
    console.error(`\n❌ No user found with email "${email}". They need to have signed in at least once first.\n`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { isAdmin: !revoke },
  });

  console.log(`\n✅ ${user.name ?? email} ${revoke ? "no longer has" : "now has"} access to /admin/gels.\n`);
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
