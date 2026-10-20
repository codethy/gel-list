// components/ProfileSignOutButton.tsx

"use client";

import { signOut } from "next-auth/react";

export default function ProfileSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 border border-slate-600/50 rounded-lg hover:border-slate-500 w-full"
    >
      Sign out
    </button>
  );
}
