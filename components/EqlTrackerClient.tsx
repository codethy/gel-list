// components/EqlTrackerClient.tsx
//
// /eql-tracker's interactive shell — a searchable list of set names (the
// full list + the signed-in user's own stats are loaded server-side in
// app/eql-tracker/page.tsx, since the set catalog here is admin-curated
// and expected to stay small, same reasoning as why
// AdminBreakerProfilesClient.tsx doesn't paginate). Clicking a name opens
// EqlSetModal for that set.

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import EqlSetModal from "./EqlSetModal";
import type { UserEqlStats } from "@/lib/data/eqlTracker";

interface EqlSetListItem {
  id: string;
  setName: string;
}

export default function EqlTrackerClient({
  sets,
  isSignedIn,
  userStats,
}: {
  sets: EqlSetListItem[];
  isSignedIn: boolean;
  userStats: UserEqlStats | null;
}) {
  const [query, setQuery] = useState("");
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed ? sets.filter((s) => s.setName.toLowerCase().includes(trimmed)) : sets;

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search EQL sets..."
        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors mb-6"
      />

      <div className="flex items-start gap-6">
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              {sets.length === 0 ? "No sets have an EQL drop yet." : "No matching sets found."}
            </p>
          ) : (
            filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSetId(s.id)}
                className="text-left px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm font-medium text-slate-200 hover:border-slate-500 hover:text-white transition-colors"
              >
                {s.setName}
              </button>
            ))
          )}
        </div>

        <div className="shrink-0 w-56 self-start">
          {isSignedIn ? (
            userStats && (
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Your EQL History</p>
                <p className="text-sm text-slate-300">{userStats.attempts} Attempt{userStats.attempts === 1 ? "" : "s"}</p>
                <p className="text-sm text-emerald-400">{userStats.successCount} Selected</p>
                <p className="text-sm text-red-400">{userStats.failCount} Not Selected</p>
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => signIn()}
              className="w-full text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors px-4 py-3 rounded-xl border border-slate-700/50 hover:border-slate-500"
            >
              Sign in to see your EQL history
            </button>
          )}
        </div>
      </div>

      <EqlSetModal eqlSetId={activeSetId} onClose={() => setActiveSetId(null)} />
    </div>
  );
}
