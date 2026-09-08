"use client";

import { useState, useCallback } from "react";

// ─── Taxonomy ───────────────────────────────────────────────────────────────
// IMPORTANT: child `id` values are the exact enum strings stored in your DB.
// Parent `enumValue` maps to the Category enum.

export const TAXONOMY = [
  {
    id:         "Sports",
    label:      "Sports",
    enumValue:  "SPORTS",
    children: [
      { id: "SOCCER",      label: "Soccer"      },
      { id: "BASKETBALL",  label: "Basketball"  },
      { id: "BASEBALL",    label: "Baseball"    },
      { id: "FOOTBALL",    label: "Football"    },
      { id: "TENNIS",      label: "Tennis"      },
      { id: "HOCKEY",      label: "Hockey"      },
      { id: "RACING",      label: "Racing"      },
      { id: "GOLF",        label: "Golf"        },
      { id: "UFC_MMA",     label: "UFC / MMA"   },
      { id: "OTHER",       label: "Others"      },
    ],
  },
  {
    id:         "Entertainment",
    label:      "Entertainment",
    enumValue:  "ENTERTAINMENT",
    children: [
      { id: "DISNEY",       label: "Disney"       },
      { id: "MARVEL",       label: "Marvel"       },
      { id: "STAR_WARS",    label: "Star Wars"    },
      { id: "DC",           label: "DC"           },
      { id: "HARRY_POTTER", label: "Harry Potter" },
      { id: "FORTNITE",     label: "Fortnite"     },
      { id: "OTHER",        label: "Others"       },
    ],
  },
  {
    id:         "TradingCardGames",
    label:      "Trading Card Games",
    enumValue:  "TCG",
    children: [
      { id: "POKEMON",             label: "Pokemon"              },
      { id: "ONE_PIECE",           label: "One Piece"            },
      { id: "MAGIC_THE_GATHERING", label: "Magic: The Gathering" },
      { id: "YU_GI_OH",            label: "Yu-Gi-Oh"             },
      { id: "LORCANA",             label: "Disney Lorcana"       },
      { id: "RIFTBOUND",           label: "Riftbound"            },
      { id: "OTHER",               label: "Others"               },
    ],
  },
] as const;

// Year range: 2026 → 2014
const YEARS = Array.from({ length: 13 }, (_, i) => 2026 - i);

// ─── Types ──────────────────────────────────────────────────────────────────
export interface SidebarFilters {
  subcategories: Set<string>;  // e.g. Set { "SOCCER", "POKEMON" }
  years:         Set<number>;  // e.g. Set { 2024, 2025 }
}

interface SidebarProps {
  filters:  SidebarFilters;
  onChange: (filters: SidebarFilters) => void;
}

// ─── Checkbox Component ─────────────────────────────────────────────────────
function Checkbox({
  checked,
  indeterminate = false,
  onChange,
}: {
  checked:        boolean;
  indeterminate?: boolean;
  onChange:       () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      aria-checked={indeterminate ? "mixed" : checked}
      role="checkbox"
      className={`
        w-4 h-4 rounded flex items-center justify-center shrink-0 border
        transition-all duration-150
        ${checked || indeterminate
          ? "bg-white border-white"
          : "bg-transparent border-zinc-600 hover:border-zinc-400"
        }
      `}
    >
      {indeterminate && !checked ? (
        <span className="w-2 h-0.5 bg-black rounded-full block" />
      ) : checked ? (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1.5 5L4 7.5L8.5 2.5"
            stroke="black"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}

// ─── Chevron Icon ───────────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Main Sidebar ───────────────────────────────────────────────────────────
export default function Sidebar({ filters, onChange }: SidebarProps) {
  // All taxonomy sections start expanded
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(TAXONOMY.map((t) => t.id))
  );
  const [yearExpanded, setYearExpanded] = useState(true);

  const toggleSection = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Parent checkbox: select/deselect all children ──────────────────────
  const toggleParent = useCallback(
    (parent: (typeof TAXONOMY)[number]) => {
      const childIds = parent.children.map((c) => c.id);
      const allSelected = childIds.every((id) => filters.subcategories.has(id));
      const next = new Set(filters.subcategories);
      if (allSelected) {
        childIds.forEach((id) => next.delete(id));
      } else {
        childIds.forEach((id) => next.add(id));
      }
      onChange({ ...filters, subcategories: next });
    },
    [filters, onChange]
  );

  // ── Child checkbox: toggle one sub-category ────────────────────────────
  const toggleChild = useCallback(
    (childId: string) => {
      const next = new Set(filters.subcategories);
      next.has(childId) ? next.delete(childId) : next.add(childId);
      onChange({ ...filters, subcategories: next });
    },
    [filters, onChange]
  );

  // ── Year toggles ───────────────────────────────────────────────────────
  const toggleYear = useCallback(
    (year: number) => {
      const next = new Set(filters.years);
      next.has(year) ? next.delete(year) : next.add(year);
      onChange({ ...filters, years: next });
    },
    [filters, onChange]
  );

  const toggleAllYears = useCallback(() => {
    const allSelected = YEARS.every((y) => filters.years.has(y));
    onChange({ ...filters, years: allSelected ? new Set() : new Set(YEARS) });
  }, [filters, onChange]);

  // ── Derived checkbox states ────────────────────────────────────────────
  const getParentState = (parent: (typeof TAXONOMY)[number]) => {
    const childIds = parent.children.map((c) => c.id);
    const count = childIds.filter((id) => filters.subcategories.has(id)).length;
    return {
      checked:       count === childIds.length,
      indeterminate: count > 0 && count < childIds.length,
    };
  };

  const yearAllSelected  = YEARS.every((y) => filters.years.has(y));
  const yearSomeSelected = YEARS.some((y) => filters.years.has(y));

  const hasActiveFilters =
    filters.subcategories.size > 0 || filters.years.size > 0;

  return (
    <aside className="w-60 shrink-0 bg-[#0f0f0f] border-r border-[#1e1e1e] min-h-[calc(100vh-4rem)] flex flex-col overflow-y-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#1e1e1e]">
        <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
          Filter
        </span>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => onChange({ subcategories: new Set(), years: new Set() })}
            className="text-[11px] text-zinc-500 hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-col flex-1 pb-8">

        {/* ── Taxonomy Sections ── */}
        {TAXONOMY.map((parent) => {
          const { checked, indeterminate } = getParentState(parent);
          const isOpen = expanded.has(parent.id);

          return (
            <div key={parent.id} className="border-b border-[#1e1e1e]">

              {/* Parent row */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#161616] transition-colors"
                onClick={() => toggleSection(parent.id)}
              >
                <div className="flex items-center gap-2.5">
                  <Checkbox
                    checked={checked}
                    indeterminate={indeterminate}
                    onChange={() => toggleParent(parent)}
                  />
                  <span className="text-sm font-semibold text-zinc-200 select-none">
                    {parent.label}
                  </span>
                </div>
                <span className="text-zinc-500">
                  <Chevron open={isOpen} />
                </span>
              </div>

              {/* Children */}
              {isOpen && (
                <div className="pb-2 flex flex-col gap-0.5">
                  {parent.children.map((child) => {
                    const isSelected = filters.subcategories.has(child.id);
                    return (
                      <div
                        key={child.id}
                        className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                        onClick={() => toggleChild(child.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleChild(child.id)}
                        />
                        <span
                          className={`text-sm transition-colors select-none ${
                            isSelected ? "text-white" : "text-zinc-400"
                          }`}
                        >
                          {child.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          );
        })}

        {/* ── Year Section ── */}
        <div className="border-b border-[#1e1e1e]">

          {/* Year parent row */}
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#161616] transition-colors"
            onClick={() => setYearExpanded((p) => !p)}
          >
            <div className="flex items-center gap-2.5">
              <Checkbox
                checked={yearAllSelected}
                indeterminate={yearSomeSelected && !yearAllSelected}
                onChange={toggleAllYears}
              />
              <span className="text-sm font-semibold text-zinc-200 select-none">
                Year
              </span>
            </div>
            <span className="text-zinc-500">
              <Chevron open={yearExpanded} />
            </span>
          </div>

          {yearExpanded && (
            <div className="pb-2 flex flex-col gap-0.5">
              {YEARS.map((year) => {
                const isSelected = filters.years.has(year);
                return (
                  <div
                    key={year}
                    className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                    onClick={() => toggleYear(year)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleYear(year)}
                    />
                    <span
                      className={`text-sm transition-colors select-none ${
                        isSelected ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {year}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </aside>
  );
}
