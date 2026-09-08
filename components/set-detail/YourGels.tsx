// components/set-detail/YourGels.tsx

"use client";

import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

// A single gel entry as returned by the data layer
export interface GelEntry {
  id: string;
  cardTemplateId: string;
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
  cardTemplate: {
    playerName: string;
    cardType: string;
    parallelType?: string | null;
    printRun?: number | null;
    team?: string | null;
  };
}

interface YourGelsProps {
  gels: GelEntry[];
  onAddGelClick: () => void; // callback to open the Add Gel modal
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

function GelCard({ gel, index }: { gel: GelEntry; index: number }) {
  const hasFrontImage = Boolean(gel.cardFrontImageUrl);
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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="group relative flex flex-col rounded-xl bg-slate-800/60 border border-slate-700/50 overflow-hidden hover:border-slate-600/70 hover:bg-slate-800/80 transition-all duration-200"
    >
      {/* ── Card Image ──────────────────────────────────────────────── */}
      <div className="relative h-40 bg-slate-900/60 overflow-hidden">
        {hasFrontImage ? (
          <img
            src={gel.cardFrontImageUrl!}
            alt={`${gel.cardTemplate.playerName} card`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
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

        {/* Parallel */}
        {gel.cardTemplate.parallelType && (
          <p className="text-xs text-slate-400 italic">
            {gel.cardTemplate.parallelType}
          </p>
        )}

        {/* Hit context */}
        <div className="mt-auto pt-2 border-t border-slate-700/50 space-y-1">
          {hitDate && (
            <p className="text-[11px] text-slate-500">
              Pulled: {hitDate}
              {location ? ` in ${location}` : ""}
            </p>
          )}
          {gel.acquisitionMethod && (
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

export default function YourGels({ gels, onAddGelClick }: YourGelsProps) {
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
              <GelCard key={gel.id} gel={gel} index={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
