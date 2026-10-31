// components/profile/ManageFavoritesModal.tsx
//
// Lets the user pick up to 6 of their own gels as "Favorite Gels" (shown on
// their profile) and reorder the ones already picked. Pure selection UI —
// every action calls straight back up to components/profile/ProfileFavorites.tsx,
// which owns the actual data/mutations, same split as
// components/admin/AdminProductsClient.tsx + AdminAddProductModal.tsx.

"use client";

import { useState } from "react";
import Image from "next/image";
import { playerSubtitle } from "@/components/set-detail/ChecklistTable";
import type { UserGelEntry } from "@/lib/data/profile";
import type { FavoriteGelEntry } from "@/lib/data/profile";

interface ManageFavoritesModalProps {
  isOpen:      boolean;
  onClose:     () => void;
  allGels:     UserGelEntry[];
  favorites:   FavoriteGelEntry[];
  maxFavorites: number;
  busyId:      string | null; // portfolioCardId currently mid-request, if any
  onAdd:       (gel: UserGelEntry) => void;
  onRemove:    (portfolioCardId: string) => void;
  onMove:      (portfolioCardId: string, direction: "up" | "down") => void;
}

function thumbLabel(gel: UserGelEntry | FavoriteGelEntry): string {
  const sub = playerSubtitle(gel.cardTemplate);
  return sub ? `${gel.cardTemplate.playerName} — ${sub}` : gel.cardTemplate.playerName;
}

// Matches the same fields as the set checklist's own search (see
// lib/data/checklistSearch.ts's keywordSqlCondition) — player/card name,
// card number, parallel, variation name, and team, plus an exact printRun
// match when a keyword is a bare number or "/99"-style. Client-side (not a
// server round trip) since every gel the user owns is already in memory
// here. Every whitespace-separated keyword must match something for a gel
// to pass, same AND-across-keywords behavior as the server-side version.
function matchesSearch(gel: UserGelEntry, query: string): boolean {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return true;

  const haystack = [
    gel.cardTemplate.cardNumber,
    gel.cardTemplate.playerName,
    gel.cardTemplate.parallelType,
    gel.cardTemplate.variationName,
    gel.cardTemplate.team,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.every((kw) => {
    const numeric = kw.replace(/^\//, "");
    if (/^\d+$/.test(numeric) && gel.cardTemplate.printRun === parseInt(numeric, 10)) {
      return true;
    }
    return haystack.includes(kw);
  });
}

function Thumb({ gel }: { gel: UserGelEntry | FavoriteGelEntry }) {
  return (
    <div className="w-10 h-10 rounded-md bg-slate-900/60 border border-slate-700/50 overflow-hidden shrink-0 flex items-center justify-center">
      {gel.cardFrontImageUrl ? (
        <Image src={gel.cardFrontImageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )}
    </div>
  );
}

export default function ManageFavoritesModal({
  isOpen,
  onClose,
  allGels,
  favorites,
  maxFavorites,
  busyId,
  onAdd,
  onRemove,
  onMove,
}: ManageFavoritesModalProps) {
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const favoriteIds = new Set(favorites.map((f) => f.id));
  const availableBeforeSearch = allGels.filter((g) => !favoriteIds.has(g.id));
  const available = availableBeforeSearch.filter((g) => matchesSearch(g, query));
  const atLimit = favorites.length >= maxFavorites;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">Manage Favorite Gels</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pick up to {maxFavorites} — {favorites.length}/{maxFavorites} selected
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Selected favorites, reorderable ─────────────────────────── */}
        <div className="mb-6">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Your Favorites
          </p>
          {favorites.length === 0 ? (
            <p className="text-sm text-slate-500 italic">None selected yet — add some below.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {favorites.map((gel, i) => (
                <div
                  key={gel.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50"
                >
                  <Thumb gel={gel} />
                  <span className="flex-1 min-w-0 text-sm text-slate-200 truncate">{thumbLabel(gel)}</span>
                  <button
                    type="button"
                    onClick={() => onMove(gel.id, "up")}
                    disabled={i === 0 || busyId === gel.id}
                    aria-label="Move up"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(gel.id, "down")}
                    disabled={i === favorites.length - 1 || busyId === gel.id}
                    aria-label="Move down"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(gel.id)}
                    disabled={busyId === gel.id}
                    aria-label="Remove from favorites"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/80 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-30 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Everything else available to add ────────────────────────── */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            All Your Gels
          </p>
          {allGels.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Log a gel first to be able to pick a favorite.
            </p>
          ) : availableBeforeSearch.length === 0 ? (
            <p className="text-sm text-slate-500 italic">Every gel you own is already a favorite.</p>
          ) : (
            <>
              <div className="relative mb-2">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by card number, name, variation..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
                />
              </div>
              {available.length === 0 ? (
                <p className="text-sm text-slate-500 italic">No gels match your search.</p>
              ) : (
                <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                  {available.map((gel) => (
                    <div
                      key={gel.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40"
                    >
                      <Thumb gel={gel} />
                      <span className="flex-1 min-w-0 text-sm text-slate-300 truncate">{thumbLabel(gel)}</span>
                      <button
                        type="button"
                        onClick={() => onAdd(gel)}
                        disabled={atLimit || busyId === gel.id}
                        className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
