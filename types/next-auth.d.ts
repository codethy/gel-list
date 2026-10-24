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
