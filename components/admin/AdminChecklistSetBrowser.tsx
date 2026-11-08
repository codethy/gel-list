// components/admin/AdminChecklistSetBrowser.tsx
//
// "Edit a set's checklist" section of /admin — category -> subcategory ->
// set links. Each subcategory is a collapsible button (e.g. "Soccer"),
// collapsed by default, so a long set list doesn't dump every set on
// screen at once. Same chevron+toggle convention as components/Sidebar.tsx.

"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminChecklistSet } from "@/lib/data/adminChecklist";

interface CategoryGroup {
  label: string;
  subcategories: { label: string; sets: AdminChecklistSet[] }[];
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SetLink({ set }: { set: AdminChecklistSet }) {
  return (
    <Link
      href={`/admin/sets/${set.id}/checklist`}
      className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-3 hover:border-slate-500 transition-colors"
    >
      <div>
        <p className="font-medium text-white">{set.name}</p>
        <p className="text-xs text-slate-500">{set.year} &bull; {set.brand}</p>
      </div>
      <span className="text-sm text-slate-400 tabular-nums">{set.cardCount.toLocaleString()} cards</span>
    </Link>
  );
}

export default function AdminChecklistSetBrowser({ byCategory }: { byCategory: CategoryGroup[] }) {
  // Collapsed by default — keyed by "<category label>::<subcategory label>"
  // since subcategory labels aren't unique across categories on their own.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {byCategory.map((cat) => (
        <div key={cat.label}>
          <h3 className="text-base font-bold text-white mb-3">{cat.label}</h3>
          <div className="flex flex-col gap-2">
            {cat.subcategories.map((sub) => {
              const key = `${cat.label}::${sub.label}`;
              const isOpen = expanded.has(key);
              return (
                <div key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="w-full flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-3 hover:border-slate-500 transition-colors"
                  >
                    <span className="font-medium text-white">{sub.label}</span>
                    <div className="flex items-center gap-2 text-slate-400">
                      <span className="text-xs tabular-nums">{sub.sets.length} set{sub.sets.length === 1 ? "" : "s"}</span>
                      <Chevron open={isOpen} />
                    </div>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-2 mt-2 pl-2">
                      {sub.sets.map((s) => (
                        <SetLink key={s.id} set={s} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
