// prisma/seed.ts

import { createRequire } from "module";
const require = createRequire(import.meta.url);
require("dotenv").config({ path: ".env.local" });

// ── Prisma 7: must use pg adapter — datasourceUrl on constructor is removed ──
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  CardType,
  AcquisitionMethod,
  Category,
} from "@prisma/client";

const pool    = new Pool({ connectionString: process.env.DATABASE_URL as string });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting seed...");

  // ── 1. Clean existing seed data ───────────────────────────────────────────
  console.log("🧹 Cleaning old seed data...");
  await prisma.cardTransfer.deleteMany({});
  await prisma.portfolioCard.deleteMany({});
  await prisma.cardTemplate.deleteMany({});
  await prisma.cardSet.deleteMany({});
  await prisma.user.deleteMany({ where: { email: "testuser@example.com" } });
  await prisma.user.deleteMany({ where: { email: "seller@example.com" } });

  // ── 2. Create test users ──────────────────────────────────────────────────
  console.log("👤 Creating test users...");
  const user = await prisma.user.create({
    data: {
      name:     "Test User",
      email:    "testuser@example.com",
      username: "testuser",
    },
  });
  console.log(`   ✅ User created: ${user.email}`);

  const user2 = await prisma.user.create({
    data: {
      name:     "Card Seller",
      email:    "seller@example.com",
      username: "cardseller",
    },
  });
  console.log(`   ✅ Second user created: ${user2.email}`);

  // ── 3. Create a card set ──────────────────────────────────────────────────
  // subCategory is a plain String in schema.prisma — pass a plain string value.
  console.log("📦 Creating card set...");
  const cardSet = await prisma.cardSet.create({
    data: {
      name:                 "2024 Topps Series 1 Baseball",
      year:                 2024,
      brand:                "Topps",
      category:             Category.SPORTS,
      subCategory:          "BASEBALL",
      totalCardsInSet:      330,
      totalChaseCardsInSet: 10,
    },
  });
  console.log(`   ✅ Card set created: ${cardSet.name} (id: ${cardSet.id})`);

  // ── 4. Create 10 card templates ───────────────────────────────────────────
  console.log("🃏 Creating card templates...");
  const templateData = [
    { cardNumber: "1",  playerName: "Aaron Judge",      cardType: CardType.BASE_PARALLEL,     team: "New York Yankees",    parallelType: null,   printRun: null },
    { cardNumber: "2",  playerName: "Shohei Ohtani",    cardType: CardType.NUMBERED_AUTO,     team: "Los Angeles Dodgers", parallelType: "Gold", printRun: 50   },
    { cardNumber: "3",  playerName: "Mookie Betts",     cardType: CardType.BASE_PARALLEL,     team: "Los Angeles Dodgers", parallelType: null,   printRun: null },
    { cardNumber: "4",  playerName: "Ronald Acuña Jr",  cardType: CardType.NUMBERED_RELIC,    team: "Atlanta Braves",      parallelType: "Rainbow", printRun: 25 },
    { cardNumber: "5",  playerName: "Julio Rodriguez",  cardType: CardType.BASE_INSERT,       team: "Seattle Mariners",    parallelType: null,   printRun: null },
    { cardNumber: "6",  playerName: "Freddie Freeman",  cardType: CardType.NUMBERED_PARALLEL, team: "Los Angeles Dodgers", parallelType: "Blue", printRun: 150  },
    { cardNumber: "7",  playerName: "Bo Bichette",      cardType: CardType.BASE_PARALLEL,     team: "Toronto Blue Jays",  parallelType: null,   printRun: null },
    { cardNumber: "8",  playerName: "Gunnar Henderson", cardType: CardType.NUMBERED_AUTO,     team: "Baltimore Orioles",   parallelType: "Purple", printRun: 99 },
    { cardNumber: "9",  playerName: "Yordan Alvarez",   cardType: CardType.NUMBERED_RELIC,    team: "Houston Astros",      parallelType: "Gold", printRun: 10   },
    { cardNumber: "10", playerName: "Mike Trout",       cardType: CardType.BASE_PARALLEL,     team: "Los Angeles Angels",  parallelType: null,   printRun: null },
  ];

  const templates = await Promise.all(
    templateData.map((t) =>
      prisma.cardTemplate.create({
        data: {
          cardSetId:    cardSet.id,
          cardNumber:   t.cardNumber,
          playerName:   t.playerName,
          cardType:     t.cardType,
          team:         t.team,
          parallelType: t.parallelType,
          printRun:     t.printRun,
        },
      })
    )
  );
  console.log(`   ✅ ${templates.length} card templates created`);

  // ── 5. Create portfolio cards ─────────────────────────────────────────────
  console.log("💼 Creating portfolio cards...");

  const pc1 = await prisma.portfolioCard.create({
    data: {
      userId:            user.id,
      cardTemplateId:    templates[0].id,
      cardSetId:         cardSet.id,
      isHit:             true,
      isInHand:          true,
      acquisitionMethod: AcquisitionMethod.PULLED,
      hitYear:           2024,
      hitMonth:          3,
      hitCity:           "New York",
      hitCountry:        "USA",
    },
  });

  const pc2 = await prisma.portfolioCard.create({
    data: {
      userId:            user.id,
      cardTemplateId:    templates[1].id,
      cardSetId:         cardSet.id,
      isHit:             true,
      isInHand:          true,
      acquisitionMethod: AcquisitionMethod.BOUGHT,
      seller:            "cardseller",
      serialNumber:      23,
    },
  });

  const pc3 = await prisma.portfolioCard.create({
    data: {
      userId:            user2.id,
      cardTemplateId:    templates[3].id,
      cardSetId:         cardSet.id,
      isHit:             true,
      isInHand:          false,
      acquisitionMethod: AcquisitionMethod.PULLED,
      hitYear:           2024,
      hitMonth:          1,
      serialNumber:      7,
    },
  });

  console.log(`   ✅ 3 portfolio cards created`);

  // ── 6. Create card transfers ──────────────────────────────────────────────
  console.log("🔁 Creating card transfers...");

  await prisma.cardTransfer.create({
    data: {
      cardTemplateId:  templates[3].id,
      portfolioCardId: pc3.id,
      fromUserId:      user2.id,
      toUserId:        user.id,
      transferDate:    new Date("2024-04-01"),
      transferMethod:  "Sold",
      salePrice:       350.00,
      notes:           "Great card, sold quickly",
    },
  });

  await prisma.cardTransfer.create({
    data: {
      cardTemplateId:  templates[1].id,
      portfolioCardId: pc2.id,
      fromUserId:      user.id,
      toUserId:        null,
      transferDate:    new Date("2024-05-15"),
      transferMethod:  "Traded",
      notes:           "Traded at a local card show",
    },
  });

  console.log(`   ✅ 2 card transfers created`);

  // ── 7. Done ───────────────────────────────────────────────────────────────
  console.log("");
  console.log("─────────────────────────────────────────────");
  console.log("🎉 Seed complete!");
  console.log("");
  console.log(`👉 Open your browser and go to:`);
  console.log(`   http://localhost:3000/sets/${cardSet.id}`);
  console.log("─────────────────────────────────────────────");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
