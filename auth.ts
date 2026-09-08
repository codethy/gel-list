// auth.ts  (project root — same level as package.json)

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

// ─── AUTH HELPER ──────────────────────────────────────────────────────────────
// This is a convenience wrapper around NextAuth v4's getServerSession.
// By creating this helper, our page.tsx can use:
//
//   const session = await auth();
//
// ...which is clean and mirrors the NextAuth v5 API pattern,
// making it easy to upgrade later if needed.

export async function auth() {
  return await getServerSession(authOptions);
}
