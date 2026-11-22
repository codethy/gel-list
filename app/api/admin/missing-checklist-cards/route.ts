// app/api/admin/missing-checklist-cards/route.ts
//
// GET  — list the backlog, split by status ("MISSING" default | "RESOLVED").
// POST — add a card to the backlog: { cardSetId, cardNumber, playerName,
//        team? }. The card doesn't need to (and usually won't) already
//        exist in that set's checklist — that's the point of this list.
// Admin-only (see lib/admin.ts).

import { NextRequest, NextResponse } from "next/server";
import { getAdminUserId } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { listMissingChecklistCards, createMissingChecklistCard } from "@/lib/data/missingChecklistCards";

export async function GET(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") === "RESOLVED" ? "RESOLVED" : "MISSING";

  const cards = await listMissingChecklistCards(status);
  return NextResponse.json({ cards });
}

export async function POST(req: NextRequest) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const cardSetId  = typeof body?.cardSetId === "string" ? body.cardSetId : "";
  const cardNumber = typeof body?.cardNumber === "string" ? body.cardNumber.trim() : "";
  const playerName = typeof body?.playerName === "string" ? body.playerName.trim() : "";
  const team       = typeof body?.team === "string" && body.team.trim() ? body.team.trim() : null;

  if (!cardSetId) {
    return NextResponse.json({ error: "Please pick a set" }, { status: 400 });
  }
  if (!cardNumber) {
    return NextResponse.json({ error: "Card number is required" }, { status: 400 });
  }
  if (!playerName) {
    return NextResponse.json({ error: "Card name is required" }, { status: 400 });
  }

  const cardSet = await prisma.cardSet.findUnique({ where: { id: cardSetId }, select: { id: true } });
  if (!cardSet) {
    return NextResponse.json({ error: "Set not found" }, { status: 404 });
  }

  const card = await createMissingChecklistCard({ cardSetId, cardNumber, playerName, team });
  return NextResponse.json({ card }, { status: 201 });
}
