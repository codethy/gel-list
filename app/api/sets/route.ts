import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SUBCATEGORY_TO_CATEGORY } from "@/lib/taxonomy";
import { attachPrintRunTotals } from "@/lib/data/setPrintRun";

const PAGE_SIZE = 18;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const cursor        = searchParams.get("cursor") ?? undefined;
  const subcategories = searchParams.get("subcategories"); // e.g. "SOCCER,POKEMON"
  const years         = searchParams.get("years");         // e.g. "2024,2025"
  const search        = searchParams.get("search") ?? "";
  // Lets a caller ask for a smaller page than the normal browsing grid uses
  // — the Navbar's live search dropdown only ever wants a handful of
  // results, not a full PAGE_SIZE page.
  const limitParam    = Number(searchParams.get("limit"));
  const limit         = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : PAGE_SIZE;

  // ── Build Prisma where clause ──────────────────────────────────────────
  const where: Record<string, unknown> = {};

  if (subcategories) {
    const subList = subcategories.split(",").filter(Boolean);

    // Sub-category filter. Case-insensitive because `CardSet.subCategory` is
    // a free-text column (set by hand via prisma/create-set.ts or an import
    // script) rather than a real enum, so its casing isn't guaranteed to
    // match the sidebar's canonical uppercase ids (e.g. "Tennis" vs
    // "TENNIS") — without this, selecting a filter that doesn't happen to
    // match the stored casing exactly would silently show zero sets.
    where.subCategory = { in: subList, mode: Prisma.QueryMode.insensitive };

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

  // Word order doesn't matter — every keyword just has to appear somewhere
  // in the name, independently. "topps tennis graphite" matches "2026 Topps
  // Graphite Tennis" the same as "topps graphite tennis" would.
  const keywords = search.trim().split(/\s+/).filter(Boolean);
  if (keywords.length > 0) {
    where.AND = keywords.map((kw) => ({
      name: { contains: kw, mode: Prisma.QueryMode.insensitive },
    }));
  }

  // ── Query ──────────────────────────────────────────────────────────────
  try {
    const [sets, totalCount] = await Promise.all([
      prisma.cardSet.findMany({
        where,
        take: limit,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id:              true,
          name:            true,
          category:        true,
          subCategory:     true,
          year:            true,
          imageUrl:        true,
          totalHitsInSet:  true,
          totalCardsInSet: true,
        },
      }),
      prisma.cardSet.count({ where }),
    ]);

    const nextCursor =
      sets.length === limit ? sets[sets.length - 1].id : null;

    // Total print run per set — same "chase cards" figure shown in the set
    // detail banner's first stat box (see lib/data/sets.ts).
    const setsWithPrintRun = await attachPrintRunTotals(sets);

    return NextResponse.json({ sets: setsWithPrintRun, nextCursor, totalCount });

  } catch (error) {
    console.error("[GET /api/sets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sets" },
      { status: 500 }
    );
  }
}
