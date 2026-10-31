// components/admin/AdminHomepageClient.tsx
//
// /admin/homepage — lets the admin pick which sets are featured on the home
// page for each category (Sports/Entertainment/TCG), up to
// MAX_FEATURED_PER_CATEGORY, and reorder the ones already picked. Same
// select+reorder shape as components/profile/ManageFavoritesModal.tsx, but
// as a dedicated page (not a modal) since there's a search step involved.

"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { TAXONOMY } from "@/lib/taxonomy";

interface FeaturedSet {
  id:          string;
  name:        string;
  year:        number;
  subCategory: string;
  imageUrl:    string | null;
}

interface SearchResultSet extends FeaturedSet {
  category: string;
}

const MAX_FEATURED_PER_CATEGORY = 10;

function Thumb({ set }: { set: { imageUrl: string | null; name: string } }) {
  return (
    <div className="w-10 h-10 rounded-md bg-slate-900/60 border border-slate-700/50 overflow-hidden shrink-0 flex items-center justify-center">
      {set.imageUrl ? (
        <Image src={set.imageUrl} alt="" width={40} height={40} className="w-full h-full object-contain" />
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      )}
    </div>
  );
}

export default function AdminHomepageClient() {
  const [activeCategory, setActiveCategory] = useState<string>(TAXONOMY[0].enumValue);

  const [featured, setFeatured] = useState<FeaturedSet[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultSet[]>([]);
  const [searching, setSearching] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeParent = TAXONOMY.find((t) => t.enumValue === activeCategory)!;

  // ── Load the current featured list whenever the category tab changes ─────
  const loadFeatured = useCallback(async (category: string) => {
    setLoadingFeatured(true);
    try {
      const res = await fetch(`/api/admin/homepage/${category}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFeatured(data.featured);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  useEffect(() => {
    setQuery("");
    setResults([]);
    setError(null);
    loadFeatured(activeCategory);
  }, [activeCategory, loadFeatured]);

  // ── Search for sets within the active category ────────────────────────────
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }

    const childIds = activeParent.children.map((c) => c.id).join(",");
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ subcategories: childIds, search: trimmed, limit: "20", withPrintRun: "false" });
        const res = await fetch(`/api/sets?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setResults(data.sets);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(handle);
  }, [query, activeParent]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  async function handleAdd(cardSetId: string) {
    setBusyId(cardSetId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage/${activeCategory}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cardSetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFeatured(data.featured);
      else setError(data.error ?? "Could not add this set");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(cardSetId: string) {
    setBusyId(cardSetId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/homepage/${activeCategory}/${cardSetId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFeatured(data.featured);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(cardSetId: string, direction: "up" | "down") {
    const index = featured.findIndex((f) => f.id === cardSetId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= featured.length) return;

    const reordered = [...featured];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setFeatured(reordered); // optimistic
    setBusyId(cardSetId);

    try {
      const res = await fetch(`/api/admin/homepage/${activeCategory}/reorder`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderedCardSetIds: reordered.map((f) => f.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFeatured(data.featured);
    } finally {
      setBusyId(null);
    }
  }

  const featuredIds = new Set(featured.map((f) => f.id));
  const atLimit = featured.length >= MAX_FEATURED_PER_CATEGORY;

  return (
    <div>
      {/* ── Category tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800">
        {TAXONOMY.map((t) => (
          <button
            key={t.enumValue}
            type="button"
            onClick={() => setActiveCategory(t.enumValue)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeCategory === t.enumValue
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {/* ── Currently featured, reorderable ────────────────────────────── */}
      <div className="mb-8">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Featured on Home Page — {featured.length}/{MAX_FEATURED_PER_CATEGORY}
        </p>
        {loadingFeatured ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : featured.length === 0 ? (
          <p className="text-sm text-slate-500 italic">None selected yet — search below to add some.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {featured.map((set, i) => (
              <div
                key={set.id}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50"
              >
                <Thumb set={set} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{set.name}</p>
                  <p className="text-[11px] text-slate-500">{set.year} · {set.subCategory.replace(/_/g, " ")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleMove(set.id, "up")}
                  disabled={i === 0 || busyId === set.id}
                  aria-label="Move up"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(set.id, "down")}
                  disabled={i === featured.length - 1 || busyId === set.id}
                  aria-label="Move down"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(set.id)}
                  disabled={busyId === set.id}
                  aria-label="Remove from home page"
                  className="w-6 h-6 flex items-center justify-center rounded-md text-red-400/80 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-30 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Search to add ──────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Search {activeParent.label} Sets
        </p>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${activeParent.label.toLowerCase()} sets by name…`}
          className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors mb-3"
        />

        {searching ? (
          <p className="text-sm text-slate-500">Searching…</p>
        ) : query.trim() && results.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No matching sets found.</p>
        ) : results.length > 0 ? (
          <div className="flex flex-col gap-1.5 max-h-96 overflow-y-auto pr-1">
            {results.map((set) => {
              const already = featuredIds.has(set.id);
              return (
                <div
                  key={set.id}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40"
                >
                  <Thumb set={set} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{set.name}</p>
                    <p className="text-[11px] text-slate-500">{set.year} · {set.subCategory.replace(/_/g, " ")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAdd(set.id)}
                    disabled={already || atLimit || busyId === set.id}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {already ? "Added" : "+ Add"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
