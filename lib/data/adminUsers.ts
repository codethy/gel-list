// lib/data/adminUsers.ts
//
// Backs the /admin/users live counter page and its polling endpoint
// (app/api/admin/users/count/route.ts) — total number of accounts ever
// created, no filtering.

import { prisma } from "@/lib/prisma";

export async function getUserCount(): Promise<number> {
  return prisma.user.count();
}
