// app/api/eql-sets/[id]/results/route.ts
//
// POST — submit one or more EQL results in one "Track" click, all sharing
// one name. No auth required; when the caller is signed in, every result
// is linked to their account so their own EQL history can be shown on the
// main page. Body: { name, entries: [{ eqlProductId, quantity, status }] }.
// Each entry's own product/maxQuantity is re-derived server-side — never
// trusts a client-sent max.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  createEqlResults,
  EqlProductNotFoundError,
  EqlQuantityOutOfRangeError,
} from "@/lib/data/eqlTracker";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: eqlSetId } = await params;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rawEntries = Array.isArray(body?.entries) ? body.entries : [];

  if (!name) {
    return NextResponse.json({ error: "Please enter a name" }, { status: 400 });
  }
  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or fewer" }, { status: 400 });
  }
  if (rawEntries.length === 0) {
    return NextResponse.json({ error: "Please choose a result for at least one option" }, { status: 400 });
  }

  const entries: { eqlProductId: string; quantity: number; status: "SUCCESS" | "FAILED" }[] = [];
  for (const raw of rawEntries) {
    const eqlProductId = typeof raw?.eqlProductId === "string" ? raw.eqlProductId : "";
    const quantity = Number(raw?.quantity);
    const status = raw?.status;
    if (!eqlProductId) {
      return NextResponse.json({ error: "Please choose an EQL option" }, { status: 400 });
    }
    if (status !== "SUCCESS" && status !== "FAILED") {
      return NextResponse.json({ error: "Please choose Selected or Not Selected for every option you filled in" }, { status: 400 });
    }
    entries.push({ eqlProductId, quantity, status });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  try {
    const detail = await createEqlResults(eqlSetId, { entries, name, userId });
    return NextResponse.json({ detail }, { status: 201 });
  } catch (error) {
    if (error instanceof EqlProductNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof EqlQuantityOutOfRangeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
