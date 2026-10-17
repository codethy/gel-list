// components/WelcomeModal.tsx
//
// Shows once, right after a brand-new user finishes the first-sign-in name
// setup (see components/NameSetupModal.tsx, which redirects home and fires
// the "gelcards:welcome" event this listens for). Mounted globally in
// components/Providers.tsx.

"use client";

import { useEffect, useState } from "react";
import { onWelcome } from "@/lib/welcomeEvent";

export default function WelcomeModal() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => onWelcome(setName), []);

  if (!name) return null;

  const dismiss = () => setName(null);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-white bg-[#0a0a0a] p-8 flex flex-col items-center gap-4 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white">Welcome, {name}!</h2>
        <p className="text-sm text-zinc-400">
          You&apos;re all set. Browse any set below and start logging your
          Gels — the cards you&apos;ve pulled, bought, or spotted.
        </p>
        <button
          onClick={dismiss}
          className="w-full bg-white text-black font-semibold px-4 py-3 rounded-lg hover:bg-zinc-200 transition-colors mt-2"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
