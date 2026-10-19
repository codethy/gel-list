"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import SetSearchBar from "./SetSearchBar";

export default function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  return (
    <nav className="w-full h-16 bg-[#111111] border-b border-[#222222] flex items-center px-6 gap-4 sticky top-0 z-50">

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <span className="text-xl font-black tracking-tight text-white">
          Gel Cards
        </span>
      </Link>

      {/* Search Bar */}
      <div className="flex-1 max-w-xl mx-auto">
        <SetSearchBar />
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        {loading ? (
          <div className="w-24 h-6 rounded bg-zinc-700 animate-pulse" />
        ) : session?.user ? (
          <div className="flex items-center gap-3">
            {/* Name only — no profile picture. The handle underneath is
                private: only the signed-in user ever sees their own. */}
            <Link
              href="/profile"
              className="flex flex-col items-end leading-tight"
            >
              <span className="text-sm text-zinc-300 hover:text-white transition-colors font-medium">
                {session.user.name}
              </span>
              {session.user.handle && (
                <span className="text-[11px] text-zinc-500">
                  @{session.user.handle}
                </span>
              )}
            </Link>

            <button
              onClick={() => signOut()}
              className="text-xs text-zinc-500 hover:text-white transition-colors px-3 py-1.5 border border-zinc-700 rounded-lg hover:border-zinc-500"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn()}
            className="text-sm bg-white text-black font-semibold px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors"
          >
            Sign in
          </button>
        )}
      </div>

    </nav>
  );
}
