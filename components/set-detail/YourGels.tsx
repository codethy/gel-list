// components/set-detail/YourGels.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { playerSubtitle, CardImageModal, VerificationBadge, type CardImageTarget } from "./ChecklistTable";
import { getProductLabel } from "@/lib/productTypes";

// ─── TYPES ────────────────────────────────────────────────────────────────────

// A single gel entry as returned by the data layer
export interface GelEntry {
  id: string;
  cardTemplateId: string;
  // True for the user's own gel, false for a reported sighting of someone
  // else's — see AddGelModal's "logging your own gel or someone else's"
  // choice. "Your Gels" only ever receives isInHand: true entries (filtered
  // server-side in lib/data/sets.ts), but editing an existing gel reads this
  // to decide which form variant to reopen into.
  isInHand?: boolean;
  // Whether the developer has verified this gel yet — see /admin/gels.
  isVerified?: boolean;
  serialNumber?: number | null;
  hitYear?: number | null;
  hitMonth?: number | null;
  hitCity?: string | null;
  hitCountry?: string | null;
  cardFrontImageUrl?: string | null;
  cardBackImageUrl?: string | null;
  acquisitionMethod?: string | null;
  seller?: string | null;
  notes?: string | null;
  productType?: string | null;
  productTypeOther?: string | null;
  // Only ever set for the "Recent Pulls" feed (see RecentPulls.tsx) — its
  // presence is what turns on the two extra badges (logged-by name,
  // own-gel/someone-else's) on the card and in the image modal. "Your
  // Gels"/Favorites/All Your Gels never set this, since those are always
  // unambiguously the viewer's own.
  loggedByName?: string | null;
  // The logging user's @handle — used to link the loggedByName badge to
  // their public profile (/u/[handle]). Null only for the rare user with no
  // handle at all (shouldn't normally happen — see generateUniqueHandle).
  loggedByHandle?: string | null;
  cardTemplate: {
    // Only ever populated by the profile data layer (see shapeGelEntry in
    // lib/data/profile.ts) — used by ManageFavoritesModal's search. Other
    // sources of GelEntry (the set detail page's own gels/recent pulls)
    // leave it undefined; nothing there currently needs it.
    cardNumber?: string | null;
    playerName: string;
    cardType: string;
    parallelType?: string | null;
    printRun?: number | null;
    variationName?: string | null;
    team?: string | null;
  };
}

interface YourGelsProps {
  gels: GelEntry[];
  onAddGelClick: () => void; // callback to open the Add Gel modal
  onEditGel: (gel: GelEntry) => void; // callback to open the Add Gel modal in edit mode
  onDeleteGel: (gelId: string) => Promise<void>; // performs the delete + removes it from state
}

// ─── CARD TYPE BADGE ─────────────────────────────────────────────────────────

function CardTypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    AUTO: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    RELIC: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    AUTO_RELIC: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    PATCH: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    RC: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    BASE: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  };

  const classes =
    colorMap[type] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${classes}`}
    >
      {type.replace(/_/g, " ")}
    </span>
  );
}

// ─── SINGLE GEL CARD ─────────────────────────────────────────────────────────

// onEdit/onDelete are optional — omitting both renders a view-only card
// (no hover edit/delete controls), used where editing wouldn't make sense
// outside the set-detail page's own context (e.g. the profile page's
// Favorite Gels / All Your Gels views).
export function GelCard({
  gel, index, onEdit, onDelete, onOpenImage,
}: {
  gel: GelEntry;
  index: number;
  onEdit?: (gel: GelEntry) => void;
  onDelete?: (gelId: string) => Promise<void>;
  onOpenImage: (target: CardImageTarget) => void;
}) {
  const hasFrontImage = Boolean(gel.cardFrontImageUrl);
  const subtitle = playerSubtitle(gel.cardTemplate);
  const locationParts = [gel.hitCity, gel.hitCountry].filter(Boolean);
  const location = locationParts.join(", ");
  const hitDate =
    gel.hitYear && gel.hitMonth
      ? `${new Date(gel.hitYear, gel.hitMonth - 1).toLocaleString("default", {
          month: "short",
        })} ${gel.hitYear}`
      : gel.hitYear
      ? String(gel.hitYear)
      : null;
  const isPulled = gel.acquisitionMethod === "PULLED";
  const productLabel = gel.productType ? getProductLabel(gel.productType, gel.productTypeOther ?? null) : null;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [deleteFailed, setDeleteFailed]         = useState(false);

  function handleEditClick(e: React.MouseEvent) {
    e.stopPropagation();
    onEdit?.(gel);
  }

  function handleDeleteIconClick(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteFailed(false);
    setConfirmingDelete(true);
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingDelete(false);
  }

  async function handleConfirmDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(gel.id);
    } catch {
      setDeleteFailed(true);
      setConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="group relative flex flex-col rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden hover:border-slate-600/70 hover:bg-slate-800/80 transition-all duration-200"
    >
      {/* ── Card Image ──────────────────────────────────────────────── */}
      {/*
        aspect-[5/7] (a standard trading card's proportions) + object-contain
        — rather than a fixed height with object-cover — so the whole photo
        always shows regardless of exactly how a user framed it, instead of
        cropping the top/bottom off a portrait card photo.
      */}
      <div className="relative aspect-[5/7] bg-slate-900/60 overflow-hidden">
        {hasFrontImage ? (
          <button
            type="button"
            onClick={() =>
              onOpenImage({
                title: gel.cardTemplate.playerName,
                subtitle,
                imageUrl: gel.cardFrontImageUrl ?? null,
                cardBackImageUrl: gel.cardBackImageUrl ?? null,
                serialNumber: gel.serialNumber ?? null,
                printRun: gel.cardTemplate.printRun ?? null,
                loggedByName: gel.loggedByName ?? null,
                loggedByHandle: gel.loggedByHandle ?? null,
                isInHand: gel.isInHand ?? true,
              })
            }
            aria-label={`View card image for ${gel.cardTemplate.playerName}`}
            title="View image"
            className="absolute inset-0 w-full h-full cursor-zoom-in"
          >
            <img
              src={gel.cardFrontImageUrl!}
              alt={`${gel.cardTemplate.playerName} card`}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            />
          </button>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-600">
            {/* Card placeholder SVG */}
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs text-slate-600">No image</span>
          </div>
        )}

        {/* Serial number badge — top right */}
        {gel.serialNumber != null && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm text-xs font-bold text-white border border-white/10">
            #{gel.serialNumber}
            {gel.cardTemplate.printRun ? ` / ${gel.cardTemplate.printRun}` : ""}
          </div>
        )}

        {/* "Recent Pulls" only — own gel vs. a reported sighting. Solid,
            saturated background (not the usual translucent badge style) so
            it stays legible over a light/white card photo too. */}
        {gel.loggedByName && (
          <div
            className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-md text-[11px] font-bold text-white shadow-sm uppercase ${
              gel.isInHand ? "bg-emerald-600/90" : "bg-amber-600/90"
            }`}
          >
            {gel.isInHand ? "Own Gel" : "Someone Else's"}
          </div>
        )}

        {/* Edit / Delete controls — top left, revealed on hover */}
        {(onEdit || onDelete) && (
        <div
          className={`absolute top-2 left-2 flex items-center gap-1 transition-opacity duration-150 ${
            confirmingDelete ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {confirmingDelete ? (
            <div className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10">
              <span className="text-[10px] font-semibold text-slate-200">Delete?</span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                aria-label="Confirm delete"
                title="Confirm delete"
                className="w-5 h-5 flex items-center justify-center rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors duration-150"
              >
                {isDeleting ? (
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                aria-label="Cancel delete"
                title="Cancel"
                className="w-5 h-5 flex items-center justify-center rounded-md bg-slate-600/40 text-slate-300 hover:bg-slate-600/60 disabled:opacity-50 transition-colors duration-150"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleEditClick}
                aria-label="Edit this gel"
                title="Edit"
                className="w-6 h-6 flex items-center justify-center rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-white hover:bg-black/85 transition-colors duration-150"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleDeleteIconClick}
                aria-label="Delete this gel"
                title="Delete"
                className="w-6 h-6 flex items-center justify-center rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-slate-300 hover:text-red-400 hover:bg-black/85 transition-colors duration-150"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            </>
          )}
        </div>
        )}

        {/* Delete-failed notice */}
        {deleteFailed && (
          <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-red-950/90 text-red-300 text-[10px] text-center">
            Delete failed — try again
          </div>
        )}
      </div>

      {/* ── Card Info ───────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Type badge */}
        <CardTypeBadge type={gel.cardTemplate.cardType} />

        {/* Player name */}
        <p className="text-sm font-bold text-white leading-tight">
          {gel.cardTemplate.playerName}
        </p>

        {/* Team */}
        {gel.cardTemplate.team && (
          <p className="text-xs text-slate-400">{gel.cardTemplate.team}</p>
        )}

        {/* Subheader — matches the checklist row's subheader format */}
        {subtitle && (
          <p className="text-xs text-slate-400 italic">
            {subtitle}
          </p>
        )}

        {/* Hit context */}
        <div className="mt-auto pt-2 border-t border-slate-700/50 space-y-1">
          {hitDate && (
            <p className="text-[11px] text-slate-500">
              <span className="font-bold text-white">Pulled:</span> {hitDate}
            </p>
          )}
          {location && (
            <p className="text-[11px] text-slate-500">
              <span className="font-bold text-white">Location:</span> {location}
            </p>
          )}
          {productLabel && (
            <p className="text-[11px] text-slate-500">
              <span className="font-bold text-white">Product:</span> {productLabel}
            </p>
          )}
          {/* Suppressed when PULLED — "Pulled: {date}" above already says
              this; still shown for BOUGHT, where it's not redundant. */}
          {!isPulled && gel.acquisitionMethod && (
            <p className="text-[11px] text-slate-500 capitalize">
              {gel.acquisitionMethod.toLowerCase()}
              {gel.seller ? ` from ${gel.seller}` : ""}
            </p>
          )}
          {gel.notes && (
            <p className="text-[11px] text-slate-500 italic line-clamp-2">
              {gel.notes}
            </p>
          )}
          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
            <VerificationBadge isVerified={gel.isVerified ?? false} />
            {/* "Recent Pulls" only — who logged it. Links to their public
                profile (own profile, if it's the viewer's own tag — see
                app/u/[handle]/page.tsx's own-handle redirect). */}
            {gel.loggedByName && (
              gel.loggedByHandle ? (
                <Link
                  href={`/u/${gel.loggedByHandle}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-300 bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap truncate max-w-[120px]"
                >
                  {gel.loggedByName}
                </Link>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-slate-300 bg-slate-700/60 border border-slate-600/50 whitespace-nowrap truncate max-w-[120px]">
                  {gel.loggedByName}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────────────

function EmptyGelsState({ onAddGelClick }: { onAddGelClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 text-center gap-4"
    >
      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-500"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>

      <div className="space-y-1">
        <p className="text-base font-semibold text-slate-300">No gels logged yet</p>
        <p className="text-sm text-slate-500 max-w-xs">
          Hit a card from this set? Log it here to start tracking your collection.
        </p>
      </div>

      <button
        onClick={onAddGelClick}
        className="mt-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors duration-150 shadow-lg shadow-blue-900/30"
      >
        Log your first gel
      </button>
    </motion.div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function YourGels({ gels, onAddGelClick, onEditGel, onDeleteGel }: YourGelsProps) {
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);

  return (
    <section className="space-y-4">
      {/* ── Section Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">Your Gels</h2>
          {gels.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
              {gels.length}
            </span>
          )}
        </div>

        {gels.length > 0 && (
          <button
            onClick={onAddGelClick}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-600/50 hover:border-slate-500/60 transition-all duration-150"
          >
            {/* Plus icon */}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Gel
          </button>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {gels.length === 0 ? (
          <EmptyGelsState key="empty" onAddGelClick={onAddGelClick} />
        ) : (
          <motion.div
            key="grid"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
          >
            {gels.map((gel, i) => (
              <GelCard key={gel.id} gel={gel} index={i} onEdit={onEditGel} onDelete={onDeleteGel} onOpenImage={setImageTarget} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <CardImageModal
        target={imageTarget}
        onClose={() => setImageTarget(null)}
      />
    </section>
  );
}
