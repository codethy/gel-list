// components/ProfileSignOutButton.tsx

"use client";

import { signOut } from "next-auth/react";

export default function ProfileSignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="text-sm text-zinc-400 hover:text-white transition-colors px-4 py-2 border border-zinc-700 rounded-lg hover:border-zinc-500"
    >
      Sign out
    </button>
  );
}
