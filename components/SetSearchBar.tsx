// components/SetSearchBar.tsx
//
// The Navbar's search bar — a live typeahead for set names (word order
// doesn't matter; every typed word just has to appear somewhere in the
// name, see app/api/sets/route.ts). Shows up to 10 matches, three at a
// time with the rest scrollable, plus the total match count. Pressing
// Enter instead navigates to the home page's full filterable grid with
// the search applied — the same "see everything" path a sidebar filter
// already uses, see app/page.tsx.

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface SetSearchResult {
  id:       string;
  name:     string;
  year:     number;
  imageUrl: string | null;
}

const DROPDOWN_LIMIT = 10;
const DEBOUNCE_MS    = 250;

export default function SetSearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery]         = useState("");
  const [results, setResults]     = useState<SetSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isOpen, setIsOpen]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Debounced live search ──────────────────────────────────────────────
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setTotalCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/sets?search=${encodeURIComponent(trimmed)}&limit=${DROPDOWN_LIMIT}&withPrintRun=false`
        );
        if (!res.ok) return;
        const data = await res.json();
        setResults(data.sets ?? []);
        setTotalCount(data.totalCount ?? 0);
      } catch {
        setResults([]);
        setTotalCount(0);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  // ── Click outside closes the dropdown ──────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goToSet(setId: string) {
    setIsOpen(false);
    router.push(`/sets/${setId}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      setIsOpen(false);
      router.push(`/?search=${encodeURIComponent(trimmed)}`);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search sets..."
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
      />

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-[#161616] border border-[#2a2a2a] shadow-xl shadow-black/40 overflow-hidden"
          >
            {/* Result count */}
            <div className="px-3 py-2 text-[11px] text-zinc-500 border-b border-[#2a2a2a]">
              {isLoading
                ? "Searching..."
                : totalCount === 0
                ? "No sets found"
                : totalCount > DROPDOWN_LIMIT
                ? `${totalCount} results found — showing top ${DROPDOWN_LIMIT}`
                : `${totalCount} result${totalCount === 1 ? "" : "s"} found`}
            </div>

            {results.length > 0 && (
              <div className="max-h-[180px] overflow-y-auto">
                {results.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => goToSet(set.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[#222222] transition-colors duration-100 border-b border-[#222222] last:border-0"
                  >
                    <div className="w-10 h-10 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] overflow-hidden shrink-0 flex items-center justify-center">
                      {set.imageUrl ? (
                        <img
                          src={set.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-700">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-white font-medium truncate">
                        {set.name}
                      </span>
                      <span className="block text-xs text-zinc-500">{set.year}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {totalCount > DROPDOWN_LIMIT && (
              <div className="px-3 py-2 text-[11px] text-zinc-500 border-t border-[#2a2a2a]">
                Press Enter to see all {totalCount} results
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
