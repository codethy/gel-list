// lib/data/setPrintRun.ts
//
// Shared "total print run" calculation for a page of CardSets — the "chase
// cards" figure shown on each set's homepage/browse-grid card (see
// SetCard.tsx) and used by app/api/sets/route.ts, the home page's curated
// "featured sets" endpoint, and the category/subcategory browse pages.
// Every checklist card counts as its printRun, defaulting to DEFAULT_PRINT_RUN
// when unspecified. Computed via two grouped aggregates (rather than one
// query per set) so this costs exactly two queries no matter how many sets
// are being priced.

import { prisma } from "@/lib/prisma";

export const DEFAULT_PRINT_RUN = 10;

export async function attachPrintRunTotals<T extends { id: string }>(
  sets: T[]
): Promise<(T & { totalPrintRunInSet: number })[]> {
  if (sets.length === 0) return [];

  const setIds = sets.map((s) => s.id);

  const [printRunSums, unlimitedPrintRunCounts] = await Promise.all([
    prisma.checklistCard.groupBy({
      by:    ["cardSetId"],
      where: { cardSetId: { in: setIds }, printRun: { not: null } },
      _sum:  { printRun: true },
    }),
    prisma.checklistCard.groupBy({
      by:     ["cardSetId"],
      where:  { cardSetId: { in: setIds }, printRun: null },
      _count: { _all: true },
    }),
  ]);

  const printRunSumBySet    = new Map(printRunSums.map((r) => [r.cardSetId, r._sum.printRun ?? 0]));
  const unlimitedCountBySet = new Map(unlimitedPrintRunCounts.map((r) => [r.cardSetId, r._count._all]));

  return sets.map((s) => ({
    ...s,
    totalPrintRunInSet:
      (printRunSumBySet.get(s.id) ?? 0) + (unlimitedCountBySet.get(s.id) ?? 0) * DEFAULT_PRINT_RUN,
  }));
}
