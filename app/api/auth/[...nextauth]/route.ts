// app/api/auth/[...nextauth]/route.ts

import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { generateUniqueHandle } from "@/lib/userHandle";
import type { NextAuthOptions } from "next-auth";

// ─── AUTH OPTIONS ─────────────────────────────────────────────────────────────
// We export this separately so it can be imported by the auth helper
// we are about to create. This is the standard NextAuth v4 pattern.

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  session: {
    // JWT sessions: the session cookie itself is a signed token, so
    // reading it (every page load, every API route's getServerSession
    // call) never touches the database. The adapter above is still used
    // for Google sign-in itself (creating/finding the User/Account rows),
    // just not for session lookups anymore — that's what used to hit
    // Postgres on every single request, which combined with a couple of
    // 5-30s client-side pollers was keeping Neon's compute endpoint awake
    // around the clock.
    strategy: "jwt",
  },

  callbacks: {
    // Runs on sign-in (when `user` — the adapter's DB row — is passed in)
    // and whenever the client calls useSession().update() (trigger ===
    // "update", e.g. after changing your name/handle/avatar) to refresh
    // these fields from the DB without waiting for the token to expire.
    async jwt({ token, user, trigger }) {
      if (user) {
        const dbUser = user as { id: string; handle?: string | null; hasCustomName?: boolean; profileImage?: string | null };
        token.id = dbUser.id;
        token.handle = dbUser.handle ?? null;
        token.needsName = !dbUser.hasCustomName;
        token.profileImage = dbUser.profileImage ?? null;
      } else if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id as string },
          select: { name: true, handle: true, hasCustomName: true, profileImage: true },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.handle = dbUser.handle ?? null;
          token.needsName = !dbUser.hasCustomName;
          token.profileImage = dbUser.profileImage ?? null;
        }
      }
      return token;
    },
    // Copies the token's fields onto the session object returned to the
    // client/server — mirrors what the old database-session `session`
    // callback did, just reading from `token` instead of the adapter's
    // live `user` row.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.handle = (token.handle as string | null) ?? null;
        session.user.needsName = Boolean(token.needsName);
        session.user.profileImage = (token.profileImage as string | null) ?? null;
      }
      return session;
    },
  },

  events: {
    // Fires exactly once, right after the PrismaAdapter creates a brand-new
    // User row — i.e. the very first time someone signs in. We assign their
    // permanent, unique handle here so it's never missing afterward.
    async createUser({ user }) {
      const handle = await generateUniqueHandle(prisma);
      await prisma.user.update({ where: { id: user.id }, data: { handle } });
    },
  },

  pages: {
    // This tells NextAuth to use your custom sign-in page
    // (we'll build this later — for now it falls back to the default)
    signIn: "/auth/signin",
  },
};

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────
// This is what Next.js actually calls when a request hits /api/auth/*

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
