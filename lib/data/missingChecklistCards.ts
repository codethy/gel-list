// lib/data/missingChecklistCards.ts
//
// Data layer for /admin/missing-checklist-cards — a manually-curated
// backlog of cards the admin knows exist but haven't been added to a
// set's checklist yet (see MissingChecklistCard in prisma/schema.prisma).

import { prisma } from "@/lib/prisma";

export interface MissingChecklistCardRow {
  id:         string;
  cardSetId:  string;
  setName:    string;
  cardNumber: string;
  playerName: string;
  team:       string | null;
  isResolved: boolean;
  createdAt:  string;
  resolvedAt: string | null;
}

const select = {
  id:         true,
  cardSetId:  true,
  cardNumber: true,
  playerName: true,
  team:       true,
  isResolved: true,
  createdAt:  true,
  resolvedAt: true,
  cardSet:    { select: { name: true } },
} as const;

function shape(row: {
  id: string; cardSetId: string; cardNumber: string; playerName: string;
  team: string | null; isResolved: boolean; createdAt: Date; resolvedAt: Date | null;
  cardSet: { name: string };
}): MissingChecklistCardRow {
  return {
    id:         row.id,
    cardSetId:  row.cardSetId,
    setName:    row.cardSet.name,
    cardNumber: row.cardNumber,
    playerName: row.playerName,
    team:       row.team,
    isResolved: row.isResolved,
    createdAt:  row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
  };
}

// "Missing" sorts oldest-first (the longest-outstanding gaps surface
// first); "Resolved" sorts most-recently-resolved first.
export async function listMissingChecklistCards(status: "MISSING" | "RESOLVED"): Promise<MissingChecklistCardRow[]> {
  const rows = await prisma.missingChecklistCard.findMany({
    where:   { isResolved: status === "RESOLVED" },
    orderBy: status === "RESOLVED" ? { resolvedAt: "desc" } : { createdAt: "asc" },
    select,
  });
  return rows.map(shape);
}

export async function createMissingChecklistCard(input: {
  cardSetId:  string;
  cardNumber: string;
  playerName: string;
  team:       string | null;
}): Promise<MissingChecklistCardRow> {
  const row = await prisma.missingChecklistCard.create({
    data:   input,
    select,
  });
  return shape(row);
}

export async function setMissingChecklistCardResolved(id: string, isResolved: boolean): Promise<MissingChecklistCardRow | null> {
  const existing = await prisma.missingChecklistCard.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return null;

  const row = await prisma.missingChecklistCard.update({
    where: { id },
    data:  { isResolved, resolvedAt: isResolved ? new Date() : null },
    select,
  });
  return shape(row);
}

export async function deleteMissingChecklistCard(id: string): Promise<boolean> {
  const existing = await prisma.missingChecklistCard.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.missingChecklistCard.delete({ where: { id } });
  return true;
}
