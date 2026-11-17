"use client";

import { useState } from "react";
import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import SetSearchBar from "./SetSearchBar";
import NotificationBell from "./NotificationBell";
import { getInitials } from "@/lib/initials";

export default function Navbar() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <nav className="w-full bg-[#111111] border-b border-[#222222] sticky top-0 z-50">

      <div className="h-16 flex items-center px-4 sm:px-6 gap-2 sm:gap-3 md:gap-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="text-lg sm:text-xl font-black tracking-tight text-white">
            Gel Cards
          </span>
        </Link>

        {/* Search Bar + EQL Tracker (desktop) */}
        <div className="hidden md:flex flex-1 items-center gap-4 max-w-2xl mx-auto">
          <div className="flex-1">
            <SetSearchBar />
          </div>
          <Link
            href="/eql-tracker"
            className="text-sm font-bold text-white hover:text-blue-400 transition-colors shrink-0 whitespace-nowrap"
          >
            EQL Tracker
          </Link>
        </div>

        {/* Mobile search toggle */}
        <button
          type="button"
          onClick={() => setMobileSearchOpen((v) => !v)}
          aria-label="Search"
          className="md:hidden ml-auto shrink-0 p-2 text-zinc-300 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </button>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
          {loading ? (
            <div className="w-24 h-6 rounded bg-zinc-700 animate-pulse" />
          ) : session?.user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <NotificationBell />

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

                <div className="hidden sm:flex flex-col items-end leading-tight">
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
                className="text-[11px] sm:text-xs text-zinc-500 hover:text-white transition-colors px-2 sm:px-3 py-1.5 border border-zinc-700 rounded-lg hover:border-zinc-500 whitespace-nowrap"
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

      </div>

      {/* Mobile search reveal */}
      {mobileSearchOpen && (
        <div className="md:hidden flex items-center gap-3 px-4 pb-3 pt-3 border-t border-[#1e1e1e]">
          <div className="flex-1">
            <SetSearchBar />
          </div>
          <Link
            href="/eql-tracker"
            className="text-xs font-bold text-white hover:text-blue-400 transition-colors shrink-0 whitespace-nowrap"
          >
            EQL Tracker
          </Link>
          <button
            type="button"
            onClick={() => setMobileSearchOpen(false)}
            aria-label="Close search"
            className="text-zinc-400 hover:text-white transition-colors p-1 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

    </nav>
  );
}
