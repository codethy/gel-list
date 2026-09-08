import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 18;

// Maps every subCategory enum value → its parent Category enum value.
// Used to build an optional category-level pre-filter for faster DB queries.
const SUBCATEGORY_TO_CATEGORY: Record<string, string> = {
  // Sports
  SOCCER:      "SPORTS",
  BASKETBALL:  "SPORTS",
  BASEBALL:    "SPORTS",
  FOOTBALL:    "SPORTS",
  TENNIS:      "SPORTS",
  RACING:      "SPORTS",
  HOCKEY:      "SPORTS",
  GOLF:        "SPORTS",
  UFC_MMA:     "SPORTS",

  // Entertainment
  DISNEY:       "ENTERTAINMENT",
  MARVEL:       "ENTERTAINMENT",
  STAR_WARS:    "ENTERTAINMENT",
  DC:           "ENTERTAINMENT",
  HARRY_POTTER: "ENTERTAINMENT",
  FORTNITE:     "ENTERTAINMENT",

  // TCG
  POKEMON:             "TCG",
  ONE_PIECE:           "TCG",
  MAGIC_THE_GATHERING: "TCG",
  YU_GI_OH:            "TCG",
  LORCANA:             "TCG",
  RIFTBOUND:           "TCG",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const cursor        = searchParams.get("cursor") ?? undefined;
  const subcategories = searchParams.get("subcategories"); // e.g. "SOCCER,POKEMON"
  const years         = searchParams.get("years");         // e.g. "2024,2025"
  const search        = searchParams.get("search") ?? "";

  // ── Build Prisma where clause ──────────────────────────────────────────
  const where: Record<string, unknown> = {};

  if (subcategories) {
    const subList = subcategories.split(",").filter(Boolean);

    // Sub-category filter — exact enum match
    where.subCategory = { in: subList };

    // Derive parent categories from the selected sub-categories.
    // This lets Prisma also filter on the indexed `category` column,
    // which significantly speeds up queries on large datasets.
    const parentCategories = [...new Set(
      subList.map((s) => SUBCATEGORY_TO_CATEGORY[s]).filter(Boolean)
    )];
    if (parentCategories.length > 0) {
      where.category = { in: parentCategories };
    }
  }

  if (years) {
    where.year = { in: years.split(",").map(Number) };
  }

  if (search.trim()) {
    where.name = { contains: search.trim(), mode: "insensitive" };
  }

  // ── Query ──────────────────────────────────────────────────────────────
  try {
    const sets = await prisma.cardSet.findMany({
      where,
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: "desc" },
      select: {
        id:              true,
        name:            true,
        category:        true,
        subCategory:     true,
        year:            true,
        imageUrl:        true,
        totalCardsInSet: true,
        totalHitsInSet:  true,
        _count: {
          select: { cards: true },
        },
      },
    });

    const nextCursor =
      sets.length === PAGE_SIZE ? sets[sets.length - 1].id : null;

    return NextResponse.json({ sets, nextCursor });

  } catch (error) {
    console.error("[GET /api/sets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sets" },
      { status: 500 }
    );
  }
}
