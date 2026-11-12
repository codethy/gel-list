// components/CountrySelect.tsx
//
// A searchable dropdown over the static COUNTRIES list (see lib/countries.ts)
// — same search-then-pick interaction as BreakerSearch, but over a plain
// string list rather than {id, name} options. Typing clears any previously
// picked value (via onChange("")) until a list item is actually clicked, so
// a submission can never carry a stale country the user typed over but never
// re-selected.
//
// Shared between the Log a Gel form (components/set-detail/AddGelModal.tsx)
// and the admin Breaker Profile create/edit form, so both use the exact same
// country list and picking interaction.

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { COUNTRIES } from "@/lib/countries";

export default function CountrySelect({
  value,
  onChange,
  placeholder = "Search for a country...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keeps the visible text in sync when `value` changes externally (e.g.
  // the modal pre-filling a remembered default, or switching between
  // editing/creating a gel).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Revert any unselected typed text back to the real value.
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(trimmed))
    : COUNTRIES;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
      />
      <AnimatePresence>
        {isOpen && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-slate-900 border border-slate-700/60 shadow-xl shadow-black/40 overflow-hidden max-h-52 overflow-y-auto"
          >
            {filtered.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setQuery(c);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-slate-200 font-medium hover:bg-slate-800/80 transition-colors duration-100 border-b border-slate-800/60 last:border-0"
              >
                {c}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
