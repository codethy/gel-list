// components/BreakerSearch.tsx
//
// Searchable "Breaker's Name" dropdown over an in-memory list of
// BreakerProfile options — same search-then-pick interaction as
// CountrySelect in components/set-detail/AddGelModal.tsx. Typing always
// stays allowed (it becomes the free-text breakerName, same as today);
// clicking a listed option additionally links the hidden breakerProfileId,
// which is what powers that breaker's own attribution/breakdown. Typing
// over a previous selection without re-picking clears the link, so a
// submission can never carry a stale profile id for text that was edited
// away from it.
//
// Unlike CountrySelect, this field is used inside AddGelModal's
// conditionally-animated "Breaker's Name" block, which is wrapped in a
// framer-motion <motion.div className="overflow-hidden"> (needed for its
// own open/close height animation) — a plain `position: absolute` dropdown
// positioned relative to that wrapper gets silently clipped to invisible,
// even though it's still technically present in the DOM (so a plain
// isVisible() check can give a false positive). The results list is
// rendered via a portal straight into document.body, positioned with
// `position: fixed` computed from the input's own bounding rect, so it
// escapes that clipping (and any future one) entirely.

"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

export interface BreakerOption {
  id:   string;
  name: string;
}

export default function BreakerSearch({
  value,
  onChange,
  options,
  placeholder = "e.g. @username, breaker's name...",
}: {
  value: string;
  // Still accepted (callers pass the selected profile's id, if any) even
  // though this component no longer renders anything based on it — kept on
  // the type so existing call sites don't need to change, and so a future
  // admin-only "linked" indicator could read it again without touching
  // every caller.
  breakerProfileId: string;
  onChange: (name: string, breakerProfileId: string) => void;
  options: BreakerOption[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        !(target instanceof Element && target.closest('[data-breaker-search-list="true"]'))
      ) {
        setIsOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Recompute the dropdown's screen position whenever it opens, and close
  // it on scroll/resize (rather than trying to keep repositioning it live)
  // — same "close rather than chase" behavior a native <select> effectively
  // gives you.
  useLayoutEffect(() => {
    if (!isOpen || !inputRef.current) return;
    const update = () => {
      const r = inputRef.current!.getBoundingClientRect();
      setRect({ top: r.bottom, left: r.left, width: r.width });
    };
    update();
    function handleScrollOrResize() {
      setIsOpen(false);
    }
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? options.filter((o) => o.name.toLowerCase().includes(trimmed))
    : options;

  const dropdown =
    mounted && isOpen && filtered.length > 0 && rect
      ? createPortal(
          <AnimatePresence>
            <motion.div
              data-breaker-search-list="true"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              style={{ position: "fixed", top: rect.top + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
              className="rounded-xl bg-slate-900 border border-slate-700/60 shadow-xl shadow-black/40 overflow-hidden max-h-52 overflow-y-auto"
            >
              {filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.name, o.id);
                    setQuery(o.name);
                    setIsOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left text-sm text-slate-200 font-medium hover:bg-slate-800/80 transition-colors duration-100 border-b border-slate-800/60 last:border-0"
                >
                  {o.name}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value, "");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
      />
      {dropdown}
    </div>
  );
}
