"use client";

import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import SetSearchBar from "./SetSearchBar";
import { getInitials } from "@/lib/initials";

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
            {/* Avatar + name + handle, all linking to the signed-in user's
                own profile. Other users see this same handle on their
                public /u/[handle] page now too — no longer private. */}
            <Link
              href="/profile"
              className="flex items-center gap-2"
            >
              {session.user.profileImage ? (
                <Image
                  src={session.user.profileImage}
                  alt=""
                  width={32}
                  height={32}
                  className="w-8 h-8 rounded-full border border-zinc-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-black border border-zinc-700 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-black text-white">
                    {getInitials(session.user.name ?? "")}
                  </span>
                </div>
              )}

              <div className="flex flex-col items-end leading-tight">
                <span className="text-sm text-zinc-300 hover:text-white transition-colors font-medium">
                  {session.user.name}
                </span>
                {session.user.handle && (
                  <span className="text-[11px] text-zinc-500">
                    @{session.user.handle}
                  </span>
                )}
              </div>
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
