// components/NameSetupModal.tsx
//
// Blocking pop-up shown to a user the first time they sign in, requiring
// them to pick their own display name before using the app (see
// User.hasCustomName in prisma/schema.prisma). Mounted globally in
// components/Providers.tsx so it appears regardless of which page they
// land on first.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { dispatchWelcome } from "@/lib/welcomeEvent";

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 30;
const ALLOWED_CHARS = /[^A-Za-z0-9 ]/g;

export default function NameSetupModal() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "authenticated" || !session.user.needsName) {
    return null;
  }

  const trimmed = name.trim();
  const overLimit = name.length > NAME_MAX_LENGTH;
  const underMin = trimmed.length > 0 && trimmed.length < NAME_MIN_LENGTH;
  const canSubmit = trimmed.length >= NAME_MIN_LENGTH && !overLimit && !submitting;

  const handleChange = (value: string) => {
    // Hard-filter disallowed characters as the user types — only
    // spacebar, English letters, and numbers are allowed.
    setName(value.replace(ALLOWED_CHARS, ""));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      // Refreshes the session so session.user.needsName flips to false
      // and session.user.name picks up the new value everywhere (e.g. Navbar).
      await update();
      dispatchWelcome(trimmed);
      router.push("/");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white bg-[#0a0a0a] p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 className="text-xl font-bold text-white">Welcome to Gel Cards</h2>
          <p className="text-sm text-zinc-400">What should we call you?</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Your name"
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
          />

          {overLimit && (
            <p className="text-xs text-red-400">
              Name must be {NAME_MAX_LENGTH} characters or fewer.
            </p>
          )}
          {underMin && !overLimit && (
            <p className="text-xs text-red-400">
              Name must be at least {NAME_MIN_LENGTH} characters.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-white text-black font-semibold px-4 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
