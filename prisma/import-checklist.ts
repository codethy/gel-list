// prisma/import-checklist.ts
// ─────────────────────────────────────────────────────────────────────────────
// Universal XLSX → Database importer for card set checklists.
//
// HOW TO RUN:
//   npx tsx prisma/import-checklist.ts
//
// WHAT IT DOES:
//   1. Reads the config below (set name, year, brand, and xlsx filename)
//   2. Creates the CardSet if it doesn't already exist
//   3. Reads every row from your Excel file
//   4. Validates cardCategory and cardTier enum values row by row
//   5. Seeds all cards into the database in fast batches
//
// TO IMPORT A NEW SET:
//   1. Drop your .xlsx file into prisma/imports/
//   2. Update the SET CONFIG section below
//   3. Run the command above
// ─────────────────────────────────────────────────────────────────────────────

// ── Load env variables first ───────────────────────────────────────────────
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import * as path    from "path";
import * as XLSX    from "xlsx";
import { Pool }     from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Category, CardCategory, CardTier } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// ✏️  SET CONFIG — Update this section for each new set you import
// ─────────────────────────────────────────────────────────────────────────────
const SET_CONFIG = {
  // The exact name of your .xlsx file inside prisma/imports/
  fileName: "2026-topps-graphite-tennis.xlsx",

  // The name of the worksheet/tab inside the Excel file.
  // If your file only has one sheet, leave this as null — it will use the first one.
  sheetName: null as string | null,

  // ── Card Set Details ──────────────────────────────────────────────────────
  setName:     "2026 Topps Graphite Tennis",
  year:         2026,
  brand:        "Topps",
  category:     Category.SPORTS,  // ← Change if needed: Category.TCG, etc.
  subCategory:  "Tennis",

  // ── Column Mapping ────────────────────────────────────────────────────────
  // Maps the column headers in YOUR Excel file to what the database expects.
  //
  // ⚠️  REQUIRED columns — every row MUST have a value:
  //     cardNumber, playerName, cardCategory, cardTier
  //
  // ⚠️  OPTIONAL columns — blank cells are fine (stored as null):
  //     team, parallel, printRun, variationName, isHit
  //
  // NOTE: isChase is not a column — it is hardcoded to true for all imported cards.
  //
    // cardCategory must match one of these EXACT values (case-sensitive):
  //   Sports/Entertainment: BASE, PARALLEL, INSERT, AUTO, RELIC, AUTO_RELIC,
  //     PATCH_AUTO, FACSIMILE_AUTO, DUAL_AUTO, TRIPLE_AUTO, QUAD_AUTO,
  //     BOOKLET, ON_CARD_AUTO, IMAGE_VARIATION, SKETCH_ART,
  //     SHORT_PRINT, SUPER_SHORT_PRINT, CASE_HIT, PROMO
  //   TCG: REGULAR, HOLO, REVERSE_HOLO, SHADOWLESS, COLD_FOIL, HOLO_FOIL,
  //     FULL_ART, ALT_ART, OTHER_FOIL, TCG_PROMO
  //
  // cardTier must match one of these EXACT values (case-sensitive):
  //   Universal:  UNLIMITED, LIMITED, NUMBERED, ONE_OF_ONE, SP, SSP, CASE_HIT
  //   TCG Tiers:  COMMON, UNCOMMON, RARE, RR, SR, AR, SAR, UR, MUR, ACE,
  //               SHR, SSR, SUPER_RARE, LEGENDARY, EPIC, ENCHANTED, ICONIC,
  //               ALT_ART, OVER, OVER_SIGN, MYTHIC, C_ALT, UC_ALT, R_ALT,
  //               SR_ALT, SR_MANGA, SEC, SEC_ALT, LEADER, L_ALT, SPECIAL_RARE,
  //               MANGA, GOLD_MANGA, TR, DON, GOLD_DON, ULTIMATE_RARE,
  //               GHOST_RARE, PROMO

  columns: {
    // ── Required ────────────────────────────────
    cardNumber:    "cardNumber",    // e.g. "RA-1", "001", "BASE-32"
    playerName:    "playerName",    // e.g. "Carlos Alcaraz" / TCG: "Charizard ex"
    cardCategory:  "cardCategory",  // Must be a valid CardCategory enum value
    cardTier:      "cardTier",      // Must be a valid CardTier enum value

    // ── Optional ────────────────────────────────
    team:          "team",          // Sports/Entertainment only — leave blank for TCG
    parallel:      "parallel",      // e.g. "Gold", "Black", "Red" — blank for base cards
    printRun:      "printRun",      // e.g. 99, 25, 10, 1 — blank if unlimited/unknown
    variationName: "variationName", // e.g. "Planetary Pursuit Sun" — blank if none
    isHit:         "isHit",         // TRUE or FALSE — auto-derived from cardCategory if blank
  },

  // ── Batch Size ────────────────────────────────────────────────────────────
  // How many cards to insert into the database at once.
  // 100 is safe and fast. Don't go above 500.
  batchSize: 100,
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Safety check ──────────────────────────────────────────────────────────────
if (!process.env.DATABASE_URL) {
  console.error("\n❌ DATABASE_URL not found in .env.local or .env\n");
  process.exit(1);
}

// ── Database connection ───────────────────────────────────────────────────────
const pool    = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma  = new PrismaClient({ adapter } as any);

// ─────────────────────────────────────────────────────────────────────────────
// Valid enum values — derived directly from the Prisma-generated enums.
// This means if you ever add a new value to the schema, it automatically
// appears here too — no manual list to maintain.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_CARD_CATEGORIES = Object.values(CardCategory);
const VALID_CARD_TIERS      = Object.values(CardTier);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert Excel's TRUE/FALSE/1/0/"true"/"false" to a JS boolean
// ─────────────────────────────────────────────────────────────────────────────
function parseBoolean(value: any): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number")  return value === 1;
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true" || value.trim() === "1";
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safely parse a print run number (could be blank, a number, or a string)
// ─────────────────────────────────────────────────────────────────────────────
function parsePrintRun(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseInt(String(value).trim(), 10);
  return isNaN(parsed) ? null : parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: safely parse a string cell (blank → null)
// ─────────────────────────────────────────────────────────────────────────────
function parseString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate and parse a CardCategory enum value
// Returns the valid enum value, or null if it's invalid.
// ─────────────────────────────────────────────────────────────────────────────
function parseCardCategory(value: any): { valid: CardCategory | null; error: string | null } {
  const raw = parseString(value);
  if (!raw) {
    return { valid: null, error: "Missing cardCategory value" };
  }
  if (VALID_CARD_CATEGORIES.includes(raw as CardCategory)) {
    return { valid: raw as CardCategory, error: null };
  }
  return {
    valid: null,
    error: `"${raw}" is not a valid CardCategory. Valid values are: ${VALID_CARD_CATEGORIES.join(", ")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: validate and parse a CardTier enum value
// ─────────────────────────────────────────────────────────────────────────────
function parseCardTier(value: any): { valid: CardTier | null; error: string | null } {
  const raw = parseString(value);
  if (!raw) {
    return { valid: null, error: "Missing cardTier value" };
  }
  if (VALID_CARD_TIERS.includes(raw as CardTier)) {
    return { valid: raw as CardTier, error: null };
  }
  return {
    valid: null,
    error: `"${raw}" is not a valid CardTier. Valid values are: ${VALID_CARD_TIERS.join(", ")}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("  CHECKLIST IMPORTER");
  console.log("  Set: " + SET_CONFIG.setName);
  console.log("═".repeat(60) + "\n");

  // ── STEP 1: Read the Excel file ──────────────────────────────────────────
  const filePath = path.join(process.cwd(), "prisma", "imports", SET_CONFIG.fileName);

  console.log(`📂 Reading file: prisma/imports/${SET_CONFIG.fileName}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch {
    console.error(`\n❌ Could not open the file: ${filePath}`);
    console.error("   Make sure the file exists in prisma/imports/");
    console.error("   and that the fileName in SET_CONFIG is spelled correctly.\n");
    process.exit(1);
  }

  // ── Pick the right worksheet ─────────────────────────────────────────────
  const sheetName = SET_CONFIG.sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    console.error(`\n❌ Could not find sheet "${sheetName}" in your Excel file.`);
    console.error("   Available sheets: " + workbook.SheetNames.join(", "));
    console.error('   Update sheetName in SET_CONFIG to one of the above.\n');
    process.exit(1);
  }

  console.log(`   Using sheet: "${sheetName}"`);

  // ── Convert sheet to array of row objects ─────────────────────────────────
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

  console.log(`   Rows found: ${rows.length}\n`);

  if (rows.length === 0) {
    console.error("❌ The Excel file appears to be empty or has no data rows.");
    console.error("   Make sure row 1 is your header row and data starts on row 2.\n");
    process.exit(1);
  }

  // ── Preview the first row so the user can verify column mapping ───────────
  console.log("🔍 Preview of first data row (column name → value):");
  const cols     = SET_CONFIG.columns;
  const firstRow = rows[0];

  const previewFields = [
    cols.cardNumber, cols.playerName, cols.cardCategory, cols.cardTier,
    cols.team, cols.parallel, cols.printRun, cols.variationName,
    cols.isHit,
  ];

  for (const col of previewFields) {
    if (col) {
      console.log(`   "${col}" → ${JSON.stringify(firstRow[col])}`);
    }
  }
  console.log("");

  // ── Check that required columns exist in the Excel file ──────────────────
  const requiredCols  = [cols.cardNumber, cols.playerName, cols.cardCategory, cols.cardTier];
  const actualHeaders = Object.keys(firstRow);
  const missingCols: string[] = [];

  for (const col of requiredCols) {
    if (!actualHeaders.includes(col)) {
      missingCols.push(col);
    }
  }

  if (missingCols.length > 0) {
    console.error("❌ These required columns were NOT found in your Excel file:");
    for (const col of missingCols) {
      console.error(`   - "${col}"`);
    }
    console.error("\n   Your Excel file has these columns:");
    for (const h of actualHeaders) {
      console.error(`   - "${h}"`);
    }
    console.error('\n   Update the "columns" mapping in SET_CONFIG to match');
    console.error("   your actual Excel column headers.\n");
    process.exit(1);
  }

  // ── STEP 2: Create or find the CardSet ────────────────────────────────────
  console.log(`🔍 Looking for CardSet "${SET_CONFIG.setName}" in database...`);

  let cardSet = await prisma.cardSet.findFirst({
    where: {
      name:  SET_CONFIG.setName,
      year:  SET_CONFIG.year,
      brand: SET_CONFIG.brand,
    },
  });

  if (cardSet) {
    console.log(`   ✅ Found existing CardSet. ID: ${cardSet.id}`);
  } else {
    console.log("   Not found. Creating CardSet now...");
    cardSet = await prisma.cardSet.create({
      data: {
        name:                 SET_CONFIG.setName,
        year:                 SET_CONFIG.year,
        brand:                SET_CONFIG.brand,
        category:             SET_CONFIG.category,
        subCategory:          SET_CONFIG.subCategory,
        totalCardsInSet:      rows.length,
        totalHitsInSet:       0,
        totalChaseCardsInSet: 0,
      },
    });
    console.log(`   ✅ CardSet created. ID: ${cardSet.id}`);
  }

  // ── STEP 3: Check for existing cards (prevent duplicates) ─────────────────
  const existingCount = await prisma.checklistCard.count({
    where: { cardSetId: cardSet.id },
  });

  if (existingCount > 0) {
    console.log(`\n⚠️  WARNING: This set already has ${existingCount} cards in the database.`);
    console.log("   To prevent duplicates, the script will stop here.");
    console.log("   If you want to re-import, delete the existing cards first");
    console.log("   using Prisma Studio (npx prisma studio), then run this script again.\n");
    return;
  }

  // ── STEP 4: Parse all rows into card objects ──────────────────────────────
  console.log(`\n📋 Parsing ${rows.length} rows from Excel...\n`);

  const cards: any[] = [];
  const parseErrors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i];
    const rowNum = i + 2; // +2 because row 1 is the header in Excel

    const cardNumber = parseString(row[cols.cardNumber]);
    const playerName = parseString(row[cols.playerName]);

    // ── Skip entirely empty rows silently ───────────────────────────────────
    if (!cardNumber && !playerName) continue;

    // ── Validate required text fields ───────────────────────────────────────
    if (!cardNumber) {
      parseErrors.push(`Row ${rowNum}: Missing cardNumber`);
      continue;
    }
    if (!playerName) {
      parseErrors.push(`Row ${rowNum}: Missing playerName (card #${cardNumber})`);
      continue;
    }

    // ── Validate cardCategory enum ───────────────────────────────────────────
    const categoryResult = parseCardCategory(row[cols.cardCategory]);
    if (!categoryResult.valid) {
      parseErrors.push(`Row ${rowNum} (card #${cardNumber} — ${playerName}): ${categoryResult.error}`);
      continue;
    }

    // ── Validate cardTier enum ───────────────────────────────────────────────
    const tierResult = parseCardTier(row[cols.cardTier]);
    if (!tierResult.valid) {
      parseErrors.push(`Row ${rowNum} (card #${cardNumber} — ${playerName}): ${tierResult.error}`);
      continue;
    }

    // ── Parse optional fields ────────────────────────────────────────────────
    const parallel      = cols.parallel      ? parseString(row[cols.parallel])      : null;
    const printRun      = cols.printRun      ? parsePrintRun(row[cols.printRun])    : null;
    const variationName = cols.variationName ? parseString(row[cols.variationName]) : null;
    const team          = cols.team          ? parseString(row[cols.team])           : null;

    // ── Derive isHit ─────────────────────────────────────────────────────────
    // If your Excel has an explicit TRUE/FALSE in the isHit column, that is used.
    // If the cell is blank, we auto-derive from cardCategory:
    //   → true  for AUTO, RELIC, AUTO_RELIC, FACSIMILE_AUTO
    //   → false for everything else
    const HIT_CATEGORIES: CardCategory[] = [
      CardCategory.AUTO,
      CardCategory.RELIC,
      CardCategory.AUTO_RELIC,
      CardCategory.FACSIMILE_AUTO,
    ];

    const isHitRaw = row[cols.isHit];

    const isHit = (isHitRaw !== "" && isHitRaw !== null && isHitRaw !== undefined)
      ? parseBoolean(isHitRaw)
      : HIT_CATEGORIES.includes(categoryResult.valid);

    // ── isChase is always true ────────────────────────────────────────────────
    // Every card imported via this script is a chase card by definition.

    cards.push({
      cardSetId:     cardSet.id,
      cardNumber:    cardNumber,
      playerName:    playerName,
      team:          team,
      cardCategory:  categoryResult.valid,
      cardTier:      tierResult.valid,
      parallel:      parallel,
      printRun:      printRun,
      variationName: variationName,
      isHit:         isHit,
      isChase:       true,
    });
  }

  // ── Report any parse errors ───────────────────────────────────────────────
  if (parseErrors.length > 0) {
    console.log(`⚠️  ${parseErrors.length} rows had issues and will be skipped:`);
    for (const err of parseErrors.slice(0, 20)) {
      console.log(`   - ${err}`);
    }
    if (parseErrors.length > 20) {
      console.log(`   ... and ${parseErrors.length - 20} more`);
    }
    console.log("");

    // ── If MORE than 10% of rows failed, stop and ask the user to fix ────────
    const failRate = parseErrors.length / rows.length;
    if (failRate > 0.1) {
      console.error(`❌ More than 10% of rows failed validation (${parseErrors.length}/${rows.length}).`);
      console.error("   This usually means a column name mismatch or a bulk typo in your Excel file.");
      console.error("   Please fix the errors above and run again.\n");
      process.exit(1);
    }
  }

  if (cards.length === 0) {
    console.error("❌ No valid cards to insert after parsing. Please check your Excel file.\n");
    process.exit(1);
  }

  console.log(`✅ ${cards.length} cards ready to insert.\n`);

  // ── STEP 5: Insert cards in batches ───────────────────────────────────────
  const batchSize    = SET_CONFIG.batchSize;
  const totalBatches = Math.ceil(cards.length / batchSize);
  let totalInserted  = 0;

  console.log(`⚡ Inserting in batches of ${batchSize} (${totalBatches} batches total)...\n`);

  for (let i = 0; i < cards.length; i += batchSize) {
    const batch    = cards.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    await prisma.checklistCard.createMany({
      data:           batch,
      skipDuplicates: true,
    });

    totalInserted += batch.length;

    // Progress bar
    const percent = Math.round((totalInserted / cards.length) * 100);
    const filled  = Math.round(percent / 2);
    const bar     = "[" + "#".repeat(filled) + ".".repeat(50 - filled) + "]";
    process.stdout.write(`\r  ${bar} ${percent}% — Batch ${batchNum}/${totalBatches}`);
  }

  console.log("\n");

  // ── STEP 6: Update totalCardsInSet on the CardSet ─────────────────────────
  await prisma.cardSet.update({
    where: { id: cardSet.id },
    data:  { totalCardsInSet: totalInserted },
  });

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log("═".repeat(60));
  console.log("  IMPORT COMPLETE ✅");
  console.log("═".repeat(60));
  console.log(`  Set:          ${cardSet.name}`);
  console.log(`  CardSet ID:   ${cardSet.id}`);
  console.log(`  Rows in file: ${rows.length}`);
  console.log(`  Rows skipped: ${parseErrors.length} (validation errors)`);
  console.log(`  Inserted:     ${totalInserted}`);
  console.log("═".repeat(60) + "\n");

  console.log("What to do next:");
  console.log("  1. Run: npx prisma studio — to visually verify the data");
  console.log("  2. Check your app's frontend to make sure cards appear correctly");
  console.log("  3. To import another set, update SET_CONFIG and run again!\n");
}

// ─── Run ─────────────────────────────────────────────────────────────────────
main()
  .catch((e) => {
    console.error("\n💥 Unexpected error:\n");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
