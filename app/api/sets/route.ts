import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { SUBCATEGORY_TO_CATEGORY } from "@/lib/taxonomy";

const PAGE_SIZE = 18;

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
        totalHitsInSet:  true,
      },
    });

    const nextCursor =
      sets.length === PAGE_SIZE ? sets[sets.length - 1].id : null;

    // ── Total print run per set — same "chase cards" figure shown in the ──
    // set detail banner's first stat box (see lib/data/sets.ts): every
    // checklist card counts as its printRun, defaulting to 10 when
    // unspecified. Computed here via two grouped aggregates (rather than
    // one query per set) so this page's per-set totals cost two queries no
    // matter how many sets are on the page.
    const setIds = sets.map((s) => s.id);
    const DEFAULT_PRINT_RUN = 10;

    const [printRunSums, unlimitedPrintRunCounts] = await Promise.all([
      prisma.checklistCard.groupBy({
        by:    ["cardSetId"],
        where: { cardSetId: { in: setIds }, printRun: { not: null } },
        _sum:  { printRun: true },
      }),
      prisma.checklistCard.groupBy({
        by:    ["cardSetId"],
        where: { cardSetId: { in: setIds }, printRun: null },
        _count: { _all: true },
      }),
    ]);

    const printRunSumBySet     = new Map(printRunSums.map((r) => [r.cardSetId, r._sum.printRun ?? 0]));
    const unlimitedCountBySet  = new Map(unlimitedPrintRunCounts.map((r) => [r.cardSetId, r._count._all]));

    const setsWithPrintRun = sets.map((s) => ({
      ...s,
      totalPrintRunInSet:
        (printRunSumBySet.get(s.id) ?? 0) + (unlimitedCountBySet.get(s.id) ?? 0) * DEFAULT_PRINT_RUN,
    }));

    return NextResponse.json({ sets: setsWithPrintRun, nextCursor });

  } catch (error) {
    console.error("[GET /api/sets] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sets" },
      { status: 500 }
    );
  }
}
