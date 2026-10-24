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
    // We use database sessions (stored in your Neon DB via Prisma)
    strategy: "database",
  },

  callbacks: {
    // This callback adds the user's database ID (and handle) to the session
    // object. Without this, session.user.id would be undefined.
    async session({ session, user }) {
      if (session.user) {
        const dbUser = user as { handle?: string | null; hasCustomName?: boolean; profileImage?: string | null };
        session.user.id = user.id;
        session.user.handle = dbUser.handle ?? null;
        session.user.needsName = !dbUser.hasCustomName;
        session.user.profileImage = dbUser.profileImage ?? null;
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
