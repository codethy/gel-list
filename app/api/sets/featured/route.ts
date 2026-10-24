// app/api/sets/featured/route.ts
//
// GET — the admin-curated sets shown on the home page by default (no
// filters/search active), grouped by category. See /admin/homepage.

import { NextResponse } from "next/server";
import { getFeaturedSetsByCategory } from "@/lib/data/homepage";

export async function GET() {
  const grouped = await getFeaturedSetsByCategory();
  return NextResponse.json({ grouped });
}
