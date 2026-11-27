// types/next-auth.d.ts

import NextAuth, { DefaultSession } from "next-auth";

// ─── TYPE AUGMENTATION ────────────────────────────────────────────────────────
// This extends NextAuth's built-in Session type to include the user's
// database ID. Without this, TypeScript would show an error on
// session.user.id throughout the whole app.

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string | null;
      needsName: boolean;
      profileImage: string | null;
    } & DefaultSession["user"];
  }
}

// Same fields, carried on the JWT itself now that sessions use the "jwt"
// strategy (see app/api/auth/[...nextauth]/route.ts) instead of being
// looked up from the database on every request.
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    handle: string | null;
    needsName: boolean;
    profileImage: string | null;
  }
}
