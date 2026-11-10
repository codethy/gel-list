// lib/data/userGelDefaults.ts
//
// Remembers a user's most recently submitted City/Country from "Log a Gel"
// (loggedFor "SELF" only — see app/api/sets/[id]/gels/route.ts and
// .../[gelId]/route.ts), so the next time they log a gel those fields are
// pre-filled instead of starting blank every time. Also remembers a
// separate bucket of fields for loggedFor "OTHER" ("Someone Else's Gel")
// submissions — see rememberSightingDefaults below — kept fully independent
// of the SELF-only memory above since the two flows track different things.

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

export interface UserSightingDefaults {
  lastSightingMethod:  string | null;
  lastSightingMonth:   number | null;
  lastSightingYear:    number | null;
  lastSightingCountry: string | null;
}

export async function getUserSightingDefaults(userId: string): Promise<UserSightingDefaults> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { lastSightingMethod: true, lastSightingMonth: true, lastSightingYear: true, lastSightingCountry: true },
  });
  return {
    lastSightingMethod:  user?.lastSightingMethod  ?? null,
    lastSightingMonth:   user?.lastSightingMonth   ?? null,
    lastSightingYear:    user?.lastSightingYear    ?? null,
    lastSightingCountry: user?.lastSightingCountry ?? null,
  };
}

// acquisitionMethod is always a validated non-empty string by the time any
// caller reaches this (required for both SELF and OTHER submissions), so
// it's written unconditionally; month/year/country follow the same
// non-destructive "only overwrite when provided" rule as
// rememberGelLocationDefaults above.
export async function rememberSightingDefaults(
  userId:            string,
  acquisitionMethod: unknown,
  hitMonth:          unknown,
  hitYear:           unknown,
  hitCountry:        unknown
): Promise<void> {
  const data: { lastSightingMethod?: string; lastSightingMonth?: number; lastSightingYear?: number; lastSightingCountry?: string } = {};
  if (typeof acquisitionMethod === "string" && acquisitionMethod) data.lastSightingMethod = acquisitionMethod;
  if (typeof hitMonth === "number") data.lastSightingMonth = hitMonth;
  if (typeof hitYear === "number") data.lastSightingYear = hitYear;
  if (typeof hitCountry === "string" && hitCountry.trim()) data.lastSightingCountry = hitCountry;

  if (Object.keys(data).length === 0) return;

  await prisma.user.update({ where: { id: userId }, data });
}
