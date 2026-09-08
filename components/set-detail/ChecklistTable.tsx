// components/set-detail/ChecklistTable.tsx
"use client";

import { useState, useTransition, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface CardHistoryEvent {
  id: string;
  eventType:
    | "PULLED"
    | "BOUGHT"
    | "TRANSFERRED_OUT"
    | "TRANSFERRED_IN"
    | "CURRENTLY_OWNS";
  username: string;
  displayName?: string | null;
  occurredAt?: string | null;
  note?: string | null;
}

export type CardStatus = "Available" | "Owned" | "Surfaced";

export interface ChecklistRow {
  id: string;
  cardNumber: string | null;
  imageUrl?: string | null;
  playerName: string;
  team?: string | null;
  cardType: string;
  parallelType?: string | null;
  printRun?: number | null;
  status: CardStatus;
  ownedGelId?: string | null;
  likeCount: number;
  isLikedByUser: boolean;
  notes?: string | null;
  cardHistory: CardHistoryEvent[];
}

export interface ChecklistMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface ChecklistTableProps {
  rows: ChecklistRow[];
  meta: ChecklistMeta;
  setId: string;
  onAddGelClick: (templateId: string, playerName: string) => void;
  onFilterChange: (filters: {
    search?: string;
    filterType?: string | null;
    filterTeam?: string | null;
    page?: number;
  }) => void;
  isLoading?: boolean;
  availableTeams: string[];
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Values MUST match CardCategory enum values exactly (case-sensitive).
// Sports & Entertainment categories are shown first, TCG at the bottom.

const CARD_TYPES = [
  // ── Universal ──────────────────────────────────────────────────────
  { label: "All Types",          value: ""                },

  // ── Sports & Entertainment ─────────────────────────────────────────
  { label: "Base",               value: "BASE"            },
  { label: "Parallel",           value: "PARALLEL"        },
  { label: "Insert",             value: "INSERT"          },
  { label: "Auto",               value: "AUTO"            },
  { label: "Relic",              value: "RELIC"           },
  { label: "Auto Relic",         value: "AUTO_RELIC"      },
  { label: "Patch Auto",         value: "PATCH_AUTO"      },
  { label: "Facsimile Auto",     value: "FACSIMILE_AUTO"  },
  { label: "Dual Auto",          value: "DUAL_AUTO"       },
  { label: "Triple Auto",        value: "TRIPLE_AUTO"     },
  { label: "Quad Auto",          value: "QUAD_AUTO"       },
  { label: "Booklet",            value: "BOOKLET"         },
  { label: "On Card Auto",       value: "ON_CARD_AUTO"    },
  { label: "Image Variation",    value: "IMAGE_VARIATION" },
  { label: "Sketch Art",         value: "SKETCH_ART"      },
  { label: "Short Print",        value: "SHORT_PRINT"     },
  { label: "Super Short Print",  value: "SUPER_SHORT_PRINT"},
  { label: "Case Hit",           value: "CASE_HIT"        },
  { label: "Promo",              value: "PROMO"           },

  // ── TCG ────────────────────────────────────────────────────────────
  { label: "Regular",            value: "REGULAR"         },
  { label: "Holo",               value: "HOLO"            },
  { label: "Reverse Holo",       value: "REVERSE_HOLO"    },
  { label: "Shadowless",         value: "SHADOWLESS"      },
  { label: "Cold Foil",          value: "COLD_FOIL"       },
  { label: "Holo Foil",          value: "HOLO_FOIL"       },
  { label: "Full Art",           value: "FULL_ART"        },
  { label: "Alt Art",            value: "ALT_ART"         },
  { label: "Other Foil",         value: "OTHER_FOIL"      },
  { label: "TCG Promo",          value: "TCG_PROMO"       },
];

const EVENT_META: Record<
  CardHistoryEvent["eventType"],
  { label: string; color: string; dotColor: string }
> = {
  PULLED:          { label: "Pulled",               color: "text-blue-300",    dotColor: "bg-blue-500"    },
  BOUGHT:          { label: "Purchased",             color: "text-violet-300",  dotColor: "bg-violet-500"  },
  TRANSFERRED_OUT: { label: "Transferred out",       color: "text-amber-300",   dotColor: "bg-amber-500"   },
  TRANSFERRED_IN:  { label: "Received via transfer", color: "text-teal-300",    dotColor: "bg-teal-500"    },
  CURRENTLY_OWNS:  { label: "Currently owns",        color: "text-emerald-300", dotColor: "bg-emerald-500" },
};

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CardStatus }) {
  if (status === "Owned") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/20 text-emerald-300 border-emerald-500/30 whitespace-nowrap">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
        Owned
      </span>
    );
  }
  if (status === "Surfaced") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-amber-500/20 text-amber-300 border-amber-500/30 whitespace-nowrap">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        Surfaced
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-red-500/20 text-red-400 border-red-500/30 whitespace-nowrap">
      <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="5" />
      </svg>
      Available
    </span>
  );
}

// ─── CARD TYPE BADGE ──────────────────────────────────────────────────────────

function CardTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    AUTO:       "bg-blue-500/20 text-blue-300 border-blue-500/30",
    RELIC:      "bg-amber-500/20 text-amber-300 border-amber-500/30",
    AUTO_RELIC: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    PATCH:      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    RC:         "bg-rose-500/20 text-rose-300 border-rose-500/30",
    BASE:       "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };
  const classes =
    colorMap[type] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${classes}`}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

// ─── HEART BUTTON ─────────────────────────────────────────────────────────────

function HeartButton({
  liked, count, onToggle, isLoading,
}: {
  liked: boolean;
  count: number;
  onToggle: (e: React.MouseEvent) => void;
  isLoading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLoading}
      aria-label={liked ? "Unlike this card" : "Like this card"}
      className="flex items-center gap-1 group/heart disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <motion.div animate={{ scale: liked ? [1, 1.3, 1] : 1 }} transition={{ duration: 0.25 }}>
        {liked ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 group-hover/heart:text-red-400 transition-colors duration-150">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        )}
      </motion.div>
      <span className={`text-[11px] font-semibold tabular-nums min-w-[12px] transition-colors duration-150 ${liked ? "text-red-400" : "text-slate-500 group-hover/heart:text-red-400"}`}>
        {count > 0 ? count : ""}
      </span>
    </button>
  );
}

// ─── CARD HISTORY DRAWER ──────────────────────────────────────────────────────

function CardHistoryDrawer({ history }: { history: CardHistoryEvent[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-4 pt-2 bg-slate-900/60 border-t border-slate-700/30">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Card History
        </p>
        {history.length === 0 ? (
          <p className="text-xs text-slate-600 italic">No recorded history for this card yet.</p>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-700/60" />
            <div className="space-y-3">
              {history.map((event) => {
                const meta = EVENT_META[event.eventType];
                const dateStr = event.occurredAt
                  ? new Date(event.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null;
                return (
                  <div key={event.id} className="flex items-start gap-3 relative">
                    <div className={`mt-[3px] w-2.5 h-2.5 rounded-full shrink-0 -ml-4 ${meta.dotColor} ring-2 ring-slate-900`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug">
                        <span className={`font-bold ${meta.color}`}>{event.displayName ?? event.username}</span>
                        <span className="text-slate-400"> — {meta.label}</span>
                        {event.note && <span className="text-slate-500 italic"> &bull; {event.note}</span>}
                      </p>
                      {dateStr && <p className="text-[11px] text-slate-600 mt-0.5">{dateStr}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── SEARCH BAR ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1 min-w-[180px]">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        placeholder="Search players..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
      />
    </div>
  );
}

// ─── FILTER SELECT ────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150 cursor-pointer"
      aria-label={placeholder}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-slate-900">{o.label}</option>
      ))}
    </select>
  );
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

function Pagination({ meta, onPageChange }: { meta: ChecklistMeta; onPageChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
      <p className="text-xs text-slate-500 tabular-nums">
        Showing{" "}
        <span className="text-slate-300 font-medium">
          {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)}
        </span>{" "}
        of <span className="text-slate-300 font-medium">{meta.total.toLocaleString()}</span> cards
      </p>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onPageChange(meta.page - 1)} disabled={meta.page <= 1} className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150" aria-label="Previous page">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 tabular-nums font-medium">{meta.page} / {meta.totalPages}</span>
        <button onClick={() => onPageChange(meta.page + 1)} disabled={meta.page >= meta.totalPages} className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150" aria-label="Next page">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
        </button>
      </div>
    </div>
  );
}

// ─── ROW ──────────────────────────────────────────────────────────────────────

function ChecklistRowItem({
  row, setId, index, onAddGelClick,
}: {
  row: ChecklistRow;
  setId: string;
  index: number;
  onAddGelClick: (templateId: string, playerName: string) => void;
}) {
  const [liked, setLiked]             = useState(row.isLikedByUser);
  const [likeCount, setLikeCount]     = useState(row.likeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  async function handleLikeToggle(e: React.MouseEvent) {
    e.stopPropagation();
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(prevCount - 1, 0) : prevCount + 1);
    setLikeLoading(true);
    try {
      const res = await fetch(`/api/sets/${setId}/cards/${row.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLikeLoading(false);
    }
  }

  function handleRowClick() {
    setHistoryOpen((prev) => !prev);
  }

  function handleAddGelClick(e: React.MouseEvent) {
    e.stopPropagation();
    onAddGelClick(row.id, row.playerName);
  }

  const isOwned    = row.status === "Owned";
  const isSurfaced = row.status === "Surfaced";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.015 }}
      className={isOwned ? "bg-emerald-950/20" : isSurfaced ? "bg-amber-950/10" : ""}
    >
      {/*
        Grid layout for ChecklistRowItem:
        Mobile (up to sm): Likes (30px) | Image (36px) | No. (50px) | Player (4fr) | Type (1fr) | Status (auto) | Add a Gel (40px)
        Medium+ (md+): Likes (30px) | Image (36px) | No. (50px) | Player (2fr) | Team (1.5fr) | Type (1fr) | Status (auto) | Add a Gel (40px) | Notes (1.5fr)
      */}
      <div
        onClick={handleRowClick}
        className={`
          grid items-center gap-x-2 px-4 py-3
          grid-cols-[30px_36px_50px_4fr_1fr_auto_40px]
          md:grid-cols-[30px_36px_50px_2fr_1.5fr_1fr_auto_40px_1.5fr]
          transition-colors duration-150 cursor-pointer select-none
          ${isOwned    ? "hover:bg-emerald-950/40" : ""}
          ${isSurfaced ? "hover:bg-amber-950/20"   : ""}
          ${!isOwned && !isSurfaced ? "hover:bg-slate-800/60" : ""}
        `}
      >
        {/* Likes */}
        <div className="flex items-center">
          <HeartButton liked={liked} count={likeCount} onToggle={handleLikeToggle} isLoading={likeLoading} />
        </div>

        {/* Image */}
        <div className="flex items-center">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.playerName} className="w-7 h-9 object-cover rounded-sm border border-slate-700/50 shadow-sm" />
          ) : (
            <div className="w-7 h-9 rounded-sm border border-slate-700/40 bg-slate-800/60 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Card No. */}
        <div className="min-w-0">
          <p className="text-xs text-slate-400 tabular-nums font-mono truncate">
            {row.cardNumber ?? "—"}
          </p>
        </div>

        {/* Player + Parallel */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-200 truncate leading-tight">
            {row.playerName}
          </p>
          {row.parallelType && (
            <p className="text-[10px] text-slate-500 italic truncate">{row.parallelType}</p>
          )}
        </div>

        {/* Team — hidden below md */}
        <div className="min-w-0 hidden md:block">
          <p className="text-xs text-slate-400 truncate">{row.team ?? "—"}</p>
        </div>

        {/* Type */}
        <div className="flex items-center">
          <CardTypeBadge type={row.cardType} />
        </div>

        {/* Status + chevron */}
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {row.cardHistory.length > 0 && (
            <motion.div
              animate={{ rotate: historyOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-slate-600 shrink-0"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </motion.div>
          )}
        </div>

        {/* Add a Gel button */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleAddGelClick}
            aria-label={`Add a gel for ${row.playerName}`}
            title="Log a Gel"
            className="flex items-center justify-center w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/25 hover:border-blue-400/50 hover:text-blue-300 active:scale-95 transition-all duration-150"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {/* Notes — hidden below md */}
        <div className="min-w-0 hidden md:block">
          <p className="text-[10px] text-slate-500 italic truncate" title={row.notes ?? ""}>
            {row.notes ? row.notes : "—"}
          </p>
        </div>
      </div>

      {/* History Drawer */}
      <AnimatePresence>
        {historyOpen && <CardHistoryDrawer key="history" history={row.cardHistory} />}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ChecklistTable({
  rows, meta, setId, onAddGelClick, onFilterChange, isLoading = false, availableTeams,
}: ChecklistTableProps) {
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [, startTransition]         = useTransition();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    startTransition(() => {
      onFilterChange({ search: value, filterType: filterType || null, filterTeam: filterTeam || null, page: 1 });
    });
  }, [filterType, filterTeam, onFilterChange]);

  const handleTypeChange = useCallback((value: string) => {
    setFilterType(value);
    startTransition(() => {
      onFilterChange({ search, filterType: value || null, filterTeam: filterTeam || null, page: 1 });
    });
  }, [search, filterTeam, onFilterChange]);

  const handleTeamChange = useCallback((value: string) => {
    setFilterTeam(value);
    startTransition(() => {
      onFilterChange({ search, filterType: filterType || null, filterTeam: value || null, page: 1 });
    });
  }, [search, filterType, onFilterChange]);

  const handlePageChange = useCallback((page: number) => {
    startTransition(() => {
      onFilterChange({ search, filterType: filterType || null, filterTeam: filterTeam || null, page });
    });
  }, [search, filterType, filterTeam, onFilterChange]);

  const teamOptions = [
    { label: "All Teams", value: "" },
    ...availableTeams.map((t) => ({ label: t, value: t })),
  ];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">Full Checklist</h2>
        <span className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 text-xs font-bold border border-slate-600/50">
          {meta.total.toLocaleString()} cards
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar value={search} onChange={handleSearchChange} />
        <FilterSelect value={filterType} onChange={handleTypeChange} options={CARD_TYPES} placeholder="Filter by type" />
        {availableTeams.length > 0 && (
          <FilterSelect value={filterTeam} onChange={handleTeamChange} options={teamOptions} placeholder="Filter by team" />
        )}
      </div>

      {/* Table — overflow-x-auto allows horizontal scroll on narrow screens */}
      <div className="relative rounded-xl border border-slate-700/50 overflow-hidden">
        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horizontal scroll wrapper — ensures all columns are visible on desktop */}
        <div className="overflow-x-auto">
          {/*
            Table header — must use IDENTICAL grid template as ChecklistRowItem
            min-w-[1000px] ensures it doesn't collapse on wider screens, forcing scroll on narrow ones.
          */}
          <div className="
            grid items-center gap-x-2 px-4 py-2.5
            bg-slate-800/80 border-b border-slate-700/50
            min-w-[1000px]
            grid-cols-[30px_36px_50px_4fr_1fr_auto_40px]
            md:grid-cols-[30px_36px_50px_2fr_1.5fr_1fr_auto_40px_1.5fr]
          ">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Likes</div> {/* Changed from "Like" to "Likes" */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider"></div> {/* Blank heading for Image */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">No.</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Player</div>
            {/* Team header — hidden below md, matching the row */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Team</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Add a Gel</div> {/* Changed from "Gel" to "Add a Gel" */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Notes</div> {/* Reintroduced Notes heading */}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-700/30 min-w-[1000px]"> {/* min-w also on rows container */}
            {rows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No cards match your filters.</div>
            ) : (
              rows.map((row, i) => (
                <ChecklistRowItem key={row.id} row={row} setId={setId} index={i} onAddGelClick={onAddGelClick} />
              ))
            )}
          </div>
        </div>
      </div>

      <Pagination meta={meta} onPageChange={handlePageChange} />
    </section>
  );
}
