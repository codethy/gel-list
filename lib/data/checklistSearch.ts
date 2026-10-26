// lib/data/checklistSearch.ts
//
// Shared card-search matching for a set's checklist — used by both the main
// checklist table (app/api/sets/[id]/checklist/route.ts) and the
// lightweight Add Gel modal search (app/api/sets/[id]/checklist/search/route.ts),
// so "what counts as a match" never drifts between the two search boxes.

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Matches player/card name, card number, parallel, variation name, and
// team — plus print run when the keyword is a bare number or "/99"-style.
// Goes through raw SQL (rather than Prisma's `contains` filter) so it can
// wrap both sides of the comparison in Postgres's `unaccent()` — that's
// what lets a plain "Joao" match a checklist row named "João".
function keywordSqlCondition(keyword: string): Prisma.Sql {
  const numeric  = keyword.replace(/^\//, "");
  const printRun = /^\d+$/.test(numeric) ? parseInt(numeric, 10) : null;
  const pattern  = `%${keyword}%`;
  return Prisma.sql`(
    unaccent("playerName") ILIKE unaccent(${pattern})
    OR unaccent("cardNumber") ILIKE unaccent(${pattern})
    OR unaccent(COALESCE("parallel", '')) ILIKE unaccent(${pattern})
    OR unaccent(COALESCE("variationName", '')) ILIKE unaccent(${pattern})
    OR unaccent(COALESCE("team", '')) ILIKE unaccent(${pattern})
    ${printRun !== null ? Prisma.sql`OR "printRun" = ${printRun}` : Prisma.empty}
  )`;
}

// Returns the matching ChecklistCard ids for a search query, or null if the
// query is empty (meaning "don't filter by id at all" — the caller should
// skip adding an `id: { in: ... }` clause in that case). An empty array is
// a real result (zero matches), distinct from null.
export async function findMatchingChecklistCardIds(
  setId: string,
  rawQuery: string
): Promise<string[] | null> {
  const keywords = rawQuery.trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return null;

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`
      SELECT "id" FROM "ChecklistCard"
      WHERE "cardSetId" = ${setId}
        AND ${Prisma.join(keywords.map(keywordSqlCondition), " AND ")}
    `
  );
  return rows.map((r) => r.id);
}
