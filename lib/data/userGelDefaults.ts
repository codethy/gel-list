// lib/data/userGelDefaults.ts
//
// Remembers a user's most recently submitted City/Country from "Log a Gel"
// (loggedFor "SELF" only — see app/api/sets/[id]/gels/route.ts and
// .../[gelId]/route.ts), so the next time they log a gel those fields are
// pre-filled instead of starting blank every time.

import { prisma } from "@/lib/prisma";

export interface UserGelDefaults {
  lastGelCity:    string | null;
  lastGelCountry: string | null;
}

export async function getUserGelDefaults(userId: string): Promise<UserGelDefaults> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { lastGelCity: true, lastGelCountry: true },
  });
  return {
    lastGelCity:    user?.lastGelCity    ?? null,
    lastGelCountry: user?.lastGelCountry ?? null,
  };
}

// Only overwrites a field when this submission actually provided a
// non-empty value — submitting a gel with the City left blank doesn't
// erase a previously remembered default, since there's nothing new to
// remember it as.
export async function rememberGelLocationDefaults(
  userId:     string,
  hitCity:    unknown,
  hitCountry: unknown
): Promise<void> {
  const data: { lastGelCity?: string; lastGelCountry?: string } = {};
  if (typeof hitCity === "string" && hitCity.trim()) data.lastGelCity = hitCity;
  if (typeof hitCountry === "string" && hitCountry.trim()) data.lastGelCountry = hitCountry;

  if (Object.keys(data).length === 0) return;

  await prisma.user.update({ where: { id: userId }, data });
}
