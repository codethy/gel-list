// prisma/import-checklist.ts
// ─────────────────────────────────────────────────────────────────────────────
// Universal XLSX → Database importer for card set checklists.
//
// HOW TO RUN:
//   npx tsx prisma/import-checklist.ts <set-slug>              — import for real
//   npx tsx prisma/import-checklist.ts <set-slug> --dry-run     — preview only,
//                                                                  writes nothing
//
// TO IMPORT A NEW SET:
//   1. Copy prisma/imports/_template/ to a new folder, e.g.
//      prisma/imports/2026-topps-chrome-basketball/
//   2. Put your .xlsx checklist file in that folder (matching the "fileName"
//      in set.json — "checklist.xlsx" by default)
//   3. Edit that folder's set.json — set name, year, brand, category,
//      subCategory, and the column mapping for your Excel file
//   4. Run with --dry-run first to check the numbers before writing anything
//   5. Run for real once the dry-run summary looks right
//
// WHAT set.json LOOKS LIKE — see prisma/imports/_template/set.json, or an
// already-imported set's folder (e.g. prisma/imports/2026-topps-graphite-tennis/)
// for a filled-in example.
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
//
// REQUIRED columns in "columns" — every row MUST have a value:
//   cardNumber, playerName, cardCategory, cardTier
// OPTIONAL columns — blank cells are fine (stored as null):
//   team, parallel, printRun, variationName, isHit
// ─────────────────────────────────────────────────────────────────────────────

// ── Load env variables first ───────────────────────────────────────────────
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import * as fs      from "fs";
import * as path    from "path";
import * as XLSX    from "xlsx";
import { Pool }     from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Category, CardCategory, CardTier } from "@prisma/client";
import { resolveSubCategory, SUBCATEGORY_TO_CATEGORY } from "../lib/taxonomy";

// ─────────────────────────────────────────────────────────────────────────────
// Config shape — one set.json per set, under prisma/imports/<slug>/set.json
// ─────────────────────────────────────────────────────────────────────────────
interface ColumnMapping {
  cardNumber:     string;
  playerName:     string;
  cardCategory:   string;
  cardTier:       string;
  team?:          string;
  parallel?:      string;
  printRun?:      string;
  variationName?: string;
  isHit?:         string;
}

interface SetConfig {
  fileName:    string;
  sheetName:   string | null;
  setName:     string;
  year:        number;
  brand:       string;
  category:    Category;
  subCategory: string;   // resolved to the canonical taxonomy id
  columns:     ColumnMapping;
  batchSize:   number;
}

const IMPORTS_DIR = path.join(process.cwd(), "prisma", "imports");

function listAvailableSlugs(): string[] {
  if (!fs.existsSync(IMPORTS_DIR)) return [];
  return fs.readdirSync(IMPORTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && !d.name.startsWith("."))
    .map((d) => d.name)
    .sort();
}

// Loads and validates prisma/imports/<slug>/set.json. Exits with a clear,
// specific message on any problem — a bad config file should never get far
// enough to touch the database.
function loadSetConfig(slug: string): SetConfig {
  const configPath = path.join(IMPORTS_DIR, slug, "set.json");

  if (!fs.existsSync(configPath)) {
    console.error(`\n❌ No set.json found at prisma/imports/${slug}/set.json`);
    const available = listAvailableSlugs();
    if (available.length > 0) {
      console.error("\n   Sets that DO have a config:");
      for (const s of available) console.error(`   - ${s}`);
    }
    console.error("\n   To create a new one, copy prisma/imports/_template/ to");
    console.error(`   prisma/imports/${slug}/ and fill in set.json.\n`);
    process.exit(1);
  }

  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (e) {
    console.error(`\n❌ prisma/imports/${slug}/set.json is not valid JSON:`);
    console.error(`   ${(e as Error).message}\n`);
    process.exit(1);
  }

  const REQUIRED_TOP_LEVEL = ["fileName", "setName", "year", "brand", "category", "subCategory", "columns"];
  const missingTopLevel = REQUIRED_TOP_LEVEL.filter((k) => raw[k] === undefined || raw[k] === null || raw[k] === "");
  if (missingTopLevel.length > 0) {
    console.error(`\n❌ prisma/imports/${slug}/set.json is missing: ${missingTopLevel.join(", ")}\n`);
    process.exit(1);
  }

  const REQUIRED_COLUMNS = ["cardNumber", "playerName", "cardCategory", "cardTier"];
  const missingColumns = REQUIRED_COLUMNS.filter((k) => !raw.columns?.[k]);
  if (missingColumns.length > 0) {
    console.error(`\n❌ prisma/imports/${slug}/set.json's "columns" is missing: ${missingColumns.join(", ")}\n`);
    process.exit(1);
  }

  const validCategories = Object.values(Category);
  if (!validCategories.includes(raw.category)) {
    console.error(`\n❌ "${raw.category}" is not a valid category. Valid values are: ${validCategories.join(", ")}\n`);
    process.exit(1);
  }

  const subCategoryResult = resolveSubCategory(String(raw.subCategory));
  if (!subCategoryResult.valid) {
    console.error(`\n❌ ${subCategoryResult.error}\n`);
    console.error(`   Fix "subCategory" in prisma/imports/${slug}/set.json.\n`);
    process.exit(1);
  }
  const subCategory = subCategoryResult.valid;

  const expectedCategory = SUBCATEGORY_TO_CATEGORY[subCategory];
  if (raw.category !== expectedCategory) {
    console.error(
      `\n❌ category is "${raw.category}" but subCategory "${subCategory}" belongs under "${expectedCategory}".\n`
    );
    console.error(`   Fix prisma/imports/${slug}/set.json so category and subCategory agree.\n`);
    process.exit(1);
  }

  return {
    fileName:    String(raw.fileName),
    sheetName:   raw.sheetName ?? null,
    setName:     String(raw.setName),
    year:        Number(raw.year),
    brand:       String(raw.brand),
    category:    raw.category as Category,
    subCategory,
    columns:     raw.columns as ColumnMapping,
    batchSize:   raw.batchSize ?? 100,
  };
}

// ── Parse CLI args ────────────────────────────────────────────────────────────
const cliArgs  = process.argv.slice(2);
const isDryRun = cliArgs.includes("--dry-run");
const slug     = cliArgs.find((a) => !a.startsWith("--"));

if (!slug) {
  console.error("\n❌ Usage: npx tsx prisma/import-checklist.ts <set-slug> [--dry-run]\n");
  const available = listAvailableSlugs();
  if (available.length > 0) {
    console.error("   Sets with a config ready to import:");
    for (const s of available) console.error(`   - ${s}`);
    console.error("");
  }
  process.exit(1);
}

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
  const SET_CONFIG = loadSetConfig(slug!);

  console.log("\n" + "═".repeat(60));
  console.log("  CHECKLIST IMPORTER" + (isDryRun ? "  —  DRY RUN (nothing will be written)" : ""));
  console.log("  Set: " + SET_CONFIG.setName);
  console.log("═".repeat(60) + "\n");

  // ── STEP 1: Read the Excel file ──────────────────────────────────────────
  const filePath = path.join(IMPORTS_DIR, slug!, SET_CONFIG.fileName);

  console.log(`📂 Reading file: prisma/imports/${slug}/${SET_CONFIG.fileName}`);

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.readFile(filePath);
  } catch {
    console.error(`\n❌ Could not open the file: ${filePath}`);
    console.error(`   Make sure the file exists in prisma/imports/${slug}/`);
    console.error('   and that "fileName" in set.json is spelled correctly.\n');
    process.exit(1);
  }

  // ── Pick the right worksheet ─────────────────────────────────────────────
  const sheetName = SET_CONFIG.sheetName ?? workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    console.error(`\n❌ Could not find sheet "${sheetName}" in your Excel file.`);
    console.error("   Available sheets: " + workbook.SheetNames.join(", "));
    console.error('   Update "sheetName" in set.json to one of the above.\n');
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
    console.error(`\n   Update the "columns" mapping in prisma/imports/${slug}/set.json to match`);
    console.error("   your actual Excel column headers.\n");
    process.exit(1);
  }

  // ── STEP 2: Find (and, unless this is a dry run, create) the CardSet ──────
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
  } else if (isDryRun) {
    console.log("   Not found — this would create a new CardSet (skipped: dry run).");
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
  const existingCount = cardSet
    ? await prisma.checklistCard.count({ where: { cardSetId: cardSet.id } })
    : 0;

  if (existingCount > 0) {
    if (isDryRun) {
      console.log(`\n⚠️  Note: this set already has ${existingCount} cards in the database.`);
      console.log("   A real (non-dry-run) import would refuse to run to avoid duplicating them.\n");
    } else {
      console.log(`\n⚠️  WARNING: This set already has ${existingCount} cards in the database.`);
      console.log("   To prevent duplicates, the script will stop here.");
      console.log("   If you want to re-import, delete the existing cards first");
      console.log("   using Prisma Studio (npx prisma studio), then run this script again.\n");
      return;
    }
  }

  // ── STEP 4: Parse all rows into card objects ──────────────────────────────
  console.log(`\n📋 Parsing ${rows.length} rows from Excel...\n`);

  const cards: any[] = [];
  const parseErrors: string[] = [];

  // Tracks every (cardNumber, parallel) key seen so far, alongside which row
  // it first appeared on. This is the same pair the database's own
  // `@@unique([cardSetId, cardNumber, parallel])` constraint protects — but
  // checking it here, ourselves, is necessary rather than just relying on
  // that constraint: the insert below uses `skipDuplicates: true`, which
  // means a genuine spreadsheet mistake (e.g. two rows both numbered "12"
  // with no parallel) would just vanish with no error at all. Worse, when
  // `parallel` is blank on both rows, Postgres treats NULL as never equal to
  // NULL, so the unique constraint doesn't even consider those two rows a
  // conflict — they'd both insert silently, invisibly inflating the set's
  // card count. Catching this in-memory, before anything is written, is the
  // only way to actually surface it.
  const seenKeys = new Map<string, { rowNum: number; playerName: string }>();

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

    // ── Check for a duplicate (cardNumber, parallel) pair ───────────────────
    // "" (rather than null) as the no-parallel sentinel so two blank-parallel
    // rows are correctly treated as colliding here, even though Postgres's
    // NULL semantics wouldn't catch that at the database level.
    const dedupeKey = `${cardNumber}::${parallel ?? ""}`;
    const firstSeen = seenKeys.get(dedupeKey);
    if (firstSeen) {
      parseErrors.push(
        `Row ${rowNum} (card #${cardNumber}${parallel ? ` — ${parallel}` : ""} — ${playerName}): ` +
        `duplicates row ${firstSeen.rowNum} (${firstSeen.playerName}) — same card number and parallel`
      );
      continue;
    }
    seenKeys.set(dedupeKey, { rowNum, playerName });

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

    const isHitRaw = cols.isHit ? row[cols.isHit] : "";

    const isHit = (isHitRaw !== "" && isHitRaw !== null && isHitRaw !== undefined)
      ? parseBoolean(isHitRaw)
      : HIT_CATEGORIES.includes(categoryResult.valid);

    cards.push({
      cardSetId:     cardSet?.id ?? null,
      cardNumber:    cardNumber,
      playerName:    playerName,
      team:          team,
      cardCategory:  categoryResult.valid,
      cardTier:      tierResult.valid,
      parallel:      parallel,
      printRun:      printRun,
      variationName: variationName,
      isHit:         isHit,
      // Position among the rows actually being inserted (not the raw Excel
      // row number) — keeps this a dense 0..N-1 sequence even if some rows
      // were skipped above, and drives the checklist page's display order.
      sortOrder:     cards.length,
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

  // ── Summary shared by both dry-run and real-run output ────────────────────
  const DEFAULT_PRINT_RUN = 10;
  const categoryBreakdown = new Map<string, number>();
  const tierBreakdown     = new Map<string, number>();
  let totalPrintRun       = 0;

  for (const c of cards) {
    categoryBreakdown.set(c.cardCategory, (categoryBreakdown.get(c.cardCategory) ?? 0) + 1);
    tierBreakdown.set(c.cardTier, (tierBreakdown.get(c.cardTier) ?? 0) + 1);
    totalPrintRun += c.printRun ?? DEFAULT_PRINT_RUN;
  }

  if (isDryRun) {
    console.log("═".repeat(60));
    console.log("  DRY RUN SUMMARY — nothing was written to the database");
    console.log("═".repeat(60));
    console.log(`  Set:                 ${SET_CONFIG.setName}`);
    console.log(`  Rows in file:        ${rows.length}`);
    console.log(`  Rows skipped:        ${parseErrors.length} (validation errors — see above)`);
    console.log(`  Cards that WOULD be inserted: ${cards.length}`);
    console.log(`  "Chases in Set" total print run (sum, unnumbered = ${DEFAULT_PRINT_RUN} each): ${totalPrintRun.toLocaleString()}`);
    console.log("\n  By category:");
    for (const [cat, count] of [...categoryBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${cat.padEnd(20)} ${count}`);
    }
    console.log("\n  By tier:");
    for (const [tier, count] of [...tierBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${tier.padEnd(20)} ${count}`);
    }
    console.log("\n" + "═".repeat(60));
    console.log("  Compare the numbers above against the manufacturer's official");
    console.log("  checklist. If they match, re-run WITHOUT --dry-run to import for real.");
    console.log("═".repeat(60) + "\n");
    return;
  }

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
    where: { id: cardSet!.id },
    data:  { totalCardsInSet: totalInserted },
  });

  // ── Final summary ──────────────────────────────────────────────────────────
  console.log("═".repeat(60));
  console.log("  IMPORT COMPLETE ✅");
  console.log("═".repeat(60));
  console.log(`  Set:          ${cardSet!.name}`);
  console.log(`  CardSet ID:   ${cardSet!.id}`);
  console.log(`  Rows in file: ${rows.length}`);
  console.log(`  Rows skipped: ${parseErrors.length} (validation errors)`);
  console.log(`  Inserted:     ${totalInserted}`);
  console.log(`  Total print run ("Chases in Set"): ${totalPrintRun.toLocaleString()}`);
  console.log("═".repeat(60) + "\n");

  console.log("What to do next:");
  console.log("  1. Run: npx prisma studio — to visually verify the data");
  console.log("  2. Check your app's frontend to make sure cards appear correctly");
  console.log("  3. To import another set, create a new folder under prisma/imports/ and run again!\n");
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
