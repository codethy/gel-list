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
    | "BREAKER"
    | "EBAY"
    | "FRIEND"
    | "SOCIAL_MEDIA"
    | "OTHER"
    | "TRANSFERRED_OUT"
    | "TRANSFERRED_IN"
    | "CURRENTLY_OWNS";
  username: string;
  displayName?: string | null;
  occurredAt?: string | null;
  note?: string | null;
  // Only ever populated on the "acquired" event (PULLED/BOUGHT/etc.) —
  // transfer and ownership events have no hit-context data to show.
  location?: string | null;
  product?: string | null;
}

export type CardStatus = "Available" | "Owned" | "Surfaced";

// A single physical gel logged against a checklist card, with its own full
// chain-of-custody history. A checklist card can have more than one of
// these (e.g. two different users each logging their own numbered copy).
export interface LoggedGel {
  id: string;
  serialNumber: number | null;
  loggedAt: string;
  cardFrontImageUrl: string | null;
  cardBackImageUrl: string | null;
  isVerified: boolean;
  username: string;
  displayName: string | null;
  cardHistory: CardHistoryEvent[];
}

export interface ChecklistRow {
  id: string;
  cardNumber: string | null;
  imageUrl?: string | null;
  cardBackImageUrl?: string | null;
  playerName: string;
  team?: string | null;
  cardType: string;
  // Only ever displayed for TCG sets (as "Rarity") — see typeColumnLabel in
  // the main ChecklistTable component.
  cardTier: string;
  parallelType?: string | null;
  printRun?: number | null;
  variationName?: string | null;
  status: CardStatus;
  ownedGelId?: string | null;
  likeCount: number;
  isLikedByUser: boolean;
  gelsPulled: number;
  notes?: string | null;
  cardHistory: CardHistoryEvent[];
  loggedGels: LoggedGel[];
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
  // "SPORTS" | "ENTERTAINMENT" | "TCG" — drives the Player/Character column
  // header label.
  category: string;
  onAddGelClick: (checklistCardId: string, playerName: string) => void;
  onFilterChange: (filters: {
    search?: string;
    filterType?: string | null;
    filterTeam?: string | null;
    page?: number;
  }) => void;
  isLoading?: boolean;
  availableTeams: string[];
  availableCategories: string[];
  availableTiers: string[];
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

// Turns a CardCategory enum value (e.g. "AUTO_RELIC") into a readable label
// (e.g. "Auto Relic") — used to build the Type filter from whatever
// categories actually exist in this set, instead of a hardcoded full list.
function formatCategoryLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Narrowed to just the fields the subtitle needs, rather than the full
// ChecklistRow, so this is reusable anywhere a card's identity is shown
// (e.g. AddGelModal's card picker) without requiring a full checklist row.
export interface PlayerSubtitleSource {
  parallelType?: string | null;
  printRun?: number | null;
  variationName?: string | null;
}

// The small line under the player's name:
//   - variation name + parallel + print run, e.g. "Graphite Relics White /10"
//   - just the parallel (+ print run) when there's no variation name, e.g. "Purple /99"
//   - variation name (+ print run) when there's no parallel, e.g. "Clay Court Masters /25",
//     or just "Mirrored" for a Case Hit with no print run
//   - nothing when the card has neither
export function playerSubtitle(row: PlayerSubtitleSource): string | null {
  const printRunSuffix = row.printRun ? ` /${row.printRun}` : "";

  if (row.variationName && row.parallelType) {
    return `${row.variationName} ${row.parallelType}${printRunSuffix}`;
  }
  if (row.parallelType) {
    return `${row.parallelType}${printRunSuffix}`;
  }
  if (row.variationName) {
    return `${row.variationName}${printRunSuffix}`;
  }
  return null;
}

const EVENT_META: Record<
  CardHistoryEvent["eventType"],
  { label: string; color: string; dotColor: string }
> = {
  PULLED:          { label: "Pulled",               color: "text-blue-300",    dotColor: "bg-blue-500"    },
  BOUGHT:          { label: "Purchased",             color: "text-violet-300",  dotColor: "bg-violet-500"  },
  // "Someone else's gel" sources — reported sightings, not owned copies.
  BREAKER:         { label: "Seen from a breaker",    color: "text-orange-300",  dotColor: "bg-orange-500"  },
  EBAY:            { label: "Seen on eBay",            color: "text-orange-300",  dotColor: "bg-orange-500"  },
  FRIEND:          { label: "Seen via a friend",       color: "text-orange-300",  dotColor: "bg-orange-500"  },
  SOCIAL_MEDIA:    { label: "Seen on social media",    color: "text-orange-300",  dotColor: "bg-orange-500"  },
  OTHER:           { label: "Seen elsewhere",          color: "text-orange-300",  dotColor: "bg-orange-500"  },
  TRANSFERRED_OUT: { label: "Transferred out",       color: "text-amber-300",   dotColor: "bg-amber-500"   },
  TRANSFERRED_IN:  { label: "Received via transfer", color: "text-teal-300",    dotColor: "bg-teal-500"    },
  CURRENTLY_OWNS:  { label: "Currently owns",        color: "text-emerald-300", dotColor: "bg-emerald-500" },
};

// ─── GELS CELL ────────────────────────────────────────────────────────────────
// Shows how many gels have been logged against a card, alongside its print
// run when it has one (e.g. "2/99"). For unlimited/unspecified-print-run
// cards, just the count — left blank entirely when nothing's been logged.
//
// Color signals how many are left, for numbered cards:
//   green  — none logged yet (all still available)
//   yellow — some logged, some still available
//   red    — logged count has reached (or passed) the print run — sold out
// A card with no print run has no "sold out" ceiling to compare against, so
// any logged count there is shown as yellow (some logged, no upper bound).

function GelsCell({ gelsPulled, printRun }: { gelsPulled: number; printRun?: number | null }) {
  const text = printRun
    ? `${gelsPulled}/${printRun}`
    : gelsPulled > 0
    ? String(gelsPulled)
    : "";

  if (!text) return null;

  const colorClasses =
    printRun && gelsPulled >= printRun
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : printRun && gelsPulled === 0
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";

  return (
    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${colorClasses}`}>
      {text}
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

// ─── VERIFICATION BADGE ───────────────────────────────────────────────────────
// Every logged gel is reviewed by the developer at /admin/gels before it's
// trusted — this reflects that review state wherever a logged gel is shown.

export function VerificationBadge({ isVerified }: { isVerified: boolean }) {
  return isVerified ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 whitespace-nowrap">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-amber-500/15 text-amber-300 border-amber-500/30 whitespace-nowrap">
      Not Verified
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
                      {event.location && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-bold text-white">Location:</span> {event.location}
                        </p>
                      )}
                      {event.product && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          <span className="font-bold text-white">Product:</span> {event.product}
                        </p>
                      )}
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

// ─── LOGGED GELS MODAL ────────────────────────────────────────────────────────
// Opened by clicking a checklist row that has at least one logged gel. Lists
// every physical copy logged against that card (not just one), sorted
// serialized-first (ascending by serial number), then unserialized ones by
// when they were logged. Clicking one reveals its own full Card History via
// the same CardHistoryDrawer used elsewhere.
//
// What each list item actually displays here is intentionally minimal for
// now — a later step will flesh that out further.

function LoggedGelsModal({
  row,
  onClose,
  onOpenImage,
}: {
  row: ChecklistRow | null;
  onClose: () => void;
  onOpenImage: (target: CardImageTarget) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <AnimatePresence>
      {row && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60"
            role="dialog"
            aria-modal="true"
            aria-label={`Logged gels for ${row.playerName}`}
          >
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 rounded-t-2xl" />

            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{row.playerName}</h2>
                  {playerSubtitle(row) && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{playerSubtitle(row)}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {row.loggedGels.length} logged gel{row.loggedGels.length === 1 ? "" : "s"}
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

              {/* Logged gels list */}
              <div className="space-y-2">
                {row.loggedGels.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No gels logged for this card yet.</p>
                ) : (
                  row.loggedGels.map((gel) => {
                    const isExpanded = expandedId === gel.id;
                    const label =
                      gel.serialNumber != null
                        ? `#${gel.serialNumber}${row.printRun ? ` / ${row.printRun}` : ""}`
                        : `Logged ${new Date(gel.loggedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

                    const hasGelImage = Boolean(gel.cardFrontImageUrl || gel.cardBackImageUrl);

                    return (
                      <div key={gel.id} className="rounded-xl border border-slate-700/50 overflow-hidden">
                        {/*
                          A plain div (not <button>) — the image below is its
                          own <button>, and buttons can't nest inside buttons.
                        */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setExpandedId(isExpanded ? null : gel.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setExpandedId(isExpanded ? null : gel.id);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 bg-slate-800/60 hover:bg-slate-800 transition-colors duration-150 text-left cursor-pointer"
                        >
                          {/* Image */}
                          <div className="shrink-0">
                            {hasGelImage ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenImage({
                                    title: row.playerName,
                                    subtitle: label,
                                    imageUrl: gel.cardFrontImageUrl,
                                    cardBackImageUrl: gel.cardBackImageUrl,
                                  });
                                }}
                                aria-label={`View card image for ${label}`}
                                title="View image"
                                className="cursor-zoom-in"
                              >
                                <img
                                  src={gel.cardFrontImageUrl ?? gel.cardBackImageUrl!}
                                  alt=""
                                  className="w-8 h-11 object-cover rounded-sm border border-slate-700/50 shadow-sm hover:opacity-80 hover:border-slate-500 transition-all duration-150"
                                />
                              </button>
                            ) : (
                              <div className="w-8 h-11 rounded-sm border border-slate-700/40 bg-slate-900/60 flex items-center justify-center">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
                                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                  <circle cx="8.5" cy="8.5" r="1.5" />
                                  <polyline points="21 15 16 10 5 21" />
                                </svg>
                              </div>
                            )}
                          </div>

                          {/* Label + logged-by username */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{label}</p>
                            <p className="text-xs text-slate-500 truncate">{gel.displayName ?? gel.username}</p>
                          </div>

                          <VerificationBadge isVerified={gel.isVerified} />

                          <motion.span
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-slate-500 shrink-0"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </motion.span>
                        </div>
                        <AnimatePresence>
                          {isExpanded && <CardHistoryDrawer key="history" history={gel.cardHistory} />}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── CARD IMAGE MODAL ─────────────────────────────────────────────────────────
// Opened by clicking the checklist row's thumbnail (the first-logged gel's
// front image). Shows that same gel's front and back images at full size.

// Generic enough to show any single physical card's images — the checklist
// row's own thumbnail (the first-logged gel) or one specific logged gel from
// the popup below. `subtitle` carries whatever distinguishes the two (the
// row's parallel/print-run for the former, that gel's serial/logged-date
// label for the latter).
export interface CardImageTarget {
  title: string;
  subtitle?: string | null;
  imageUrl: string | null;
  cardBackImageUrl: string | null;
}

export function CardImageModal({
  target,
  onClose,
}: {
  target: CardImageTarget | null;
  onClose: () => void;
}) {
  const hasImage = Boolean(target?.imageUrl || target?.cardBackImageUrl);

  return (
    <AnimatePresence>
      {target && hasImage && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[60] w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60"
            role="dialog"
            aria-modal="true"
            aria-label={`Card image for ${target.title}`}
          >
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 rounded-t-2xl" />

            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-white truncate">{target.title}</h2>
                  {target.subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{target.subtitle}</p>
                  )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {target.imageUrl && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Front</p>
                    <img src={target.imageUrl} alt={`${target.title} card front`} className="w-full rounded-lg border border-slate-700/50" />
                  </div>
                )}
                {target.cardBackImageUrl && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Back</p>
                    <img src={target.cardBackImageUrl} alt={`${target.title} card back`} className="w-full rounded-lg border border-slate-700/50" />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
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

// The md+ grid template for both the header and each row — must stay
// IDENTICAL between the two (see the module-level alignment note above) and
// must switch in lockstep with whether the Team column is shown at all.
// When Team is hidden (no checklist card in this set has a team — e.g.
// Entertainment/TCG sets), its 1.3fr share folds into Player instead of
// leaving a gap.
function gridColsClass(showTeam: boolean): string {
  return showTeam
    ? "grid-cols-[30px_36px_90px_4fr_1fr_96px_40px] md:grid-cols-[30px_36px_90px_1.2fr_1.3fr_0.75fr_96px_40px_100px]"
    : "grid-cols-[30px_36px_90px_4fr_1fr_96px_40px] md:grid-cols-[30px_36px_90px_1.8fr_0.75fr_96px_40px_100px]";
}

function ChecklistRowItem({
  row, setId, index, showTeam, category, onAddGelClick, onOpenHistory, onOpenImage,
}: {
  row: ChecklistRow;
  setId: string;
  index: number;
  showTeam: boolean;
  category: string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  onAddGelClick: (checklistCardId: string, playerName: string) => void;
  onOpenHistory: (row: ChecklistRow) => void;
  onOpenImage: (row: ChecklistRow) => void;
}) {
  const [liked, setLiked]             = useState(row.isLikedByUser);
  const [likeCount, setLikeCount]     = useState(row.likeCount);
  const [likeLoading, setLikeLoading] = useState(false);

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

  function handleAddGelClick(e: React.MouseEvent) {
    e.stopPropagation();
    onAddGelClick(row.id, row.playerName);
  }

  const isOwned    = row.status === "Owned";
  const isSurfaced = row.status === "Surfaced";
  const subtitle   = playerSubtitle(row);
  const hasGels    = row.gelsPulled > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.015 }}
      className={isOwned ? "bg-emerald-950/20" : isSurfaced ? "bg-amber-950/10" : ""}
    >
      {/*
        Grid layout for ChecklistRowItem — see gridColsClass() above.
        No. is 90px (not narrower) so longer card numbers like "AHP-IBL-01" display in full.
        Mobile (up to sm): Likes (30px) | Image (36px) | No. (90px) | Player (4fr) | Type (1fr) | Status (96px) | Add a Gel (40px)
        Medium+ (md+), showTeam: Likes (30px) | Image (36px) | No. (90px) | Player (1.2fr) | Team (1.3fr) | Type (0.75fr) | Status (96px) | Add a Gel (40px) | Notes (100px)
        Medium+ (md+), !showTeam: Team's track is dropped; Player (1.8fr) | Type (0.75fr) instead
      */}
      <div
        onClick={hasGels ? () => onOpenHistory(row) : undefined}
        className={`
          grid items-center gap-x-2 px-4 py-3
          ${gridColsClass(showTeam)}
          transition-colors duration-150 select-none
          ${hasGels ? "cursor-pointer" : "cursor-default"}
          ${isOwned    ? "hover:bg-emerald-950/40" : ""}
          ${isSurfaced ? "hover:bg-amber-950/20"   : ""}
          ${!isOwned && !isSurfaced && hasGels ? "hover:bg-slate-800/60" : ""}
        `}
      >
        {/* Likes */}
        <div className="flex items-center">
          <HeartButton liked={liked} count={likeCount} onToggle={handleLikeToggle} isLoading={likeLoading} />
        </div>

        {/* Image */}
        <div className="flex items-center">
          {row.imageUrl ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenImage(row);
              }}
              aria-label={`View card image for ${row.playerName}`}
              title="View image"
              className="cursor-zoom-in"
            >
              <img
                src={row.imageUrl}
                alt={row.playerName}
                className="w-7 h-9 object-cover rounded-sm border border-slate-700/50 shadow-sm hover:opacity-80 hover:border-slate-500 transition-all duration-150"
              />
            </button>
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

        {/* Player + Parallel — left padding shifts this column right, independent of the Player/Type track widths */}
        <div className="min-w-0 pl-[54px]">
          <p className="text-sm font-semibold text-slate-200 truncate leading-tight">
            {row.playerName}
          </p>
          {subtitle && (
            <p className="text-[10px] text-slate-500 italic truncate">{subtitle}</p>
          )}
        </div>

        {/* Team — hidden below md, and entirely omitted when no card in this set has one */}
        {showTeam && (
          <div className="min-w-0 hidden md:block">
            <p className="text-xs text-slate-400 truncate">{row.team ?? "—"}</p>
          </div>
        )}

        {/* Type (Sports/Entertainment) / Rarity (TCG) */}
        <div className="flex items-center justify-start">
          <CardTypeBadge type={category === "TCG" ? row.cardTier : row.cardType} />
        </div>

        {/* Gels pulled / print run + "view details" hint */}
        <div className="flex items-center justify-start gap-1.5">
          <GelsCell gelsPulled={row.gelsPulled} printRun={row.printRun} />
          {hasGels && (
            <span className="text-slate-600 shrink-0" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
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

        {/* Notes — hidden below md; extra left padding widens the gap from Add a Gel */}
        <div className="min-w-0 hidden md:block pl-3">
          <p className="text-[10px] text-slate-500 italic truncate" title={row.notes ?? ""}>
            {row.notes ? row.notes : "—"}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function ChecklistTable({
  rows, meta, setId, category, onAddGelClick, onFilterChange, isLoading = false, availableTeams, availableCategories, availableTiers,
}: ChecklistTableProps) {
  const [search, setSearch]             = useState("");
  const [filterType, setFilterType]     = useState("");
  const [filterTeam, setFilterTeam]     = useState("");
  const [historyRow, setHistoryRow]     = useState<ChecklistRow | null>(null);
  const [imageTarget, setImageTarget]   = useState<CardImageTarget | null>(null);
  const [, startTransition]             = useTransition();

  // No checklist card in this set has a team at all (Entertainment/TCG sets
  // typically don't import one) — hide the whole column rather than show a
  // column of nothing but "—".
  const showTeam = availableTeams.length > 0;

  // Sports sets feature athletes ("Player"); Entertainment and TCG sets
  // feature characters ("Character") — e.g. Harry Potter, Pokémon.
  const playerColumnLabel =
    category === "SPORTS" ? "Player" : category === "TCG" ? "Card Name" : "Character";
  // TCG cards are collected by rarity tier (Common/Rare/Secret Rare/etc. —
  // ChecklistCard.cardTier), not by print finish (Holo/Full Art/etc. —
  // cardCategory, what "Type" shows for Sports/Entertainment) — so this
  // column shows a different underlying field for TCG, not just a relabel.
  const typeColumnLabel = category === "TCG" ? "Rarity" : "Type";

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

  // TCG filters this dropdown by rarity (cardTier) instead of type
  // (cardCategory) — matches typeColumnLabel's display-side decision.
  const typeOptions = category === "TCG"
    ? [
        { label: "All Rarities", value: "" },
        ...availableTiers.map((t) => ({ label: formatCategoryLabel(t), value: t })),
      ]
    : [
        { label: "All Types", value: "" },
        ...availableCategories.map((c) => ({ label: formatCategoryLabel(c), value: c })),
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
        <FilterSelect value={filterType} onChange={handleTypeChange} options={typeOptions} placeholder={category === "TCG" ? "Filter by rarity" : "Filter by type"} />
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
          <div className={`
            grid items-center gap-x-2 px-4 py-2.5
            bg-slate-800/80 border-b border-slate-700/50
            min-w-[1000px]
            ${gridColsClass(showTeam)}
          `}>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Likes</div> {/* Changed from "Like" to "Likes" */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider"></div> {/* Blank heading for Image */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">No.</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-[54px]">{playerColumnLabel}</div>
            {/* Team header — hidden below md, matching the row; omitted entirely when no card has a team */}
            {showTeam && (
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:block">Team</div>
            )}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{typeColumnLabel}</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Gels</div>
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">Add a Gel</div> {/* Changed from "Gel" to "Add a Gel" */}
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden md:block pl-3">Notes</div> {/* Reintroduced Notes heading */}
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-700/30 min-w-[1000px]"> {/* min-w also on rows container — must match the header's min-w */}
            {rows.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">No cards match your filters.</div>
            ) : (
              rows.map((row, i) => (
                <ChecklistRowItem
                  key={row.id}
                  row={row}
                  setId={setId}
                  index={i}
                  showTeam={showTeam}
                  category={category}
                  onAddGelClick={onAddGelClick}
                  onOpenHistory={setHistoryRow}
                  onOpenImage={(row) => setImageTarget({
                    title: row.playerName,
                    subtitle: playerSubtitle(row),
                    imageUrl: row.imageUrl ?? null,
                    cardBackImageUrl: row.cardBackImageUrl ?? null,
                  })}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <Pagination meta={meta} onPageChange={handlePageChange} />

      <LoggedGelsModal
        row={historyRow}
        onClose={() => setHistoryRow(null)}
        onOpenImage={setImageTarget}
      />

      <CardImageModal
        target={imageTarget}
        onClose={() => setImageTarget(null)}
      />
    </section>
  );
}
