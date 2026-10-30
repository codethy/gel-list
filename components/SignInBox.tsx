// components/SignInBox.tsx
//
// The "sign in" card — shared by the standalone /auth/signin page and
// SignInRequiredModal (shown when a signed-out user tries to add a gel).
// Self-contained (owns its own background/border/padding) so either caller
// can just center it without re-declaring the box styling.

"use client";

import { signIn } from "next-auth/react";

export default function SignInBox({ callbackUrl = "/" }: { callbackUrl?: string }) {
  return (
    <div className="w-full max-w-md px-8 py-12 flex flex-col items-center gap-8 rounded-2xl border border-white bg-black text-white">
      {/* Logo / App Name */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-5xl font-black tracking-tight text-white">
          Gel Cards
        </h1>
        <p className="text-zinc-400 text-sm tracking-widest uppercase">
          Know Every Hit In Every Set
        </p>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-zinc-800" />

      {/* Sign In Card */}
      <div className="w-full flex flex-col gap-4">
        <p className="text-center text-zinc-300 text-sm">
          Sign in to track your hits
        </p>

        {/* Google Sign In Button */}
        <button
          onClick={() => signIn("google", { callbackUrl })}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-100 transition-all duration-200 active:scale-95"
        >
          {/* Google Icon via SVG */}
          <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
            <path d="M44.5 20H24v8.5h11.7C34.2 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" fill="#FFC107"/>
            <path d="M6.3 14.7l7 5.1C15.1 16 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.6 0-14.2 4.6-17.7 11.7z" fill="#FF3D00"/>
            <path d="M24 45c5.5 0 10.5-1.9 14.4-5.1l-6.7-5.5C29.6 35.9 26.9 37 24 37c-5.6 0-10.2-3.1-11.7-7.5l-7 5.4C8.9 41.1 15.9 45 24 45z" fill="#4CAF50"/>
            <path d="M44.5 20H24v8.5h11.7c-.7 2.7-2.4 5-4.7 6.5l6.7 5.5C41.3 37.1 44.5 31 44.5 24c0-1.4-.1-2.7-.5-4z" fill="#1976D2"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
