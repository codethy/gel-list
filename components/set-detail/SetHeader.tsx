// components/set-detail/SetHeader.tsx

"use client";

import { motion } from "framer-motion";
import Image from "next/image";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SetHeaderProps {
  setName: string;
  category: string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  sport: string;
  year: number;
  manufacturer: string;
  totalPrintRunInSet: number;
  // Plain checklist-row count — what TCG sets show instead of
  // totalPrintRunInSet, since there's no reliable print run to sum (or
  // estimate via the usual default-10-per-card) for TCG cards.
  totalCardsInSet: number;
  totalChaseCardsInSet?: number | null;
  userGelCount: number;  // how many cards this user has gelled
  chasesPulled: number;  // set-wide: every confirmed-real pulled copy, across all users
  setImageUrl?: string | null;

  // "X Packs/Boxes Opened" box + its two linked popups — see
  // lib/data/productOpenings.ts.
  packsOpenedValue: number;
  packsOpenedLabel: string; // "Packs Opened" | "Boxes Opened"
  onOpenBreakdown:  () => void;
  onOpenLogOpenings: () => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function ProgressBar({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400 font-medium">{label}</span>
        <span className="text-slate-200 font-semibold tabular-nums">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-700/60 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        />
      </div>
      <p className="text-xs text-slate-500 text-right tabular-nums">
        {pct.toFixed(1)}% complete
      </p>
    </div>
  );
}

// ─── STAT PILL ────────────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 min-w-[80px]">
      <span className="text-lg font-bold text-white tabular-nums">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium whitespace-nowrap">
        {label}
      </span>
    </div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function SetHeader({
  setName,
  category,
  sport,
  year,
  manufacturer,
  totalPrintRunInSet,
  totalCardsInSet,
  totalChaseCardsInSet,
  userGelCount,
  chasesPulled,
  setImageUrl,
  packsOpenedValue,
  packsOpenedLabel,
  onOpenBreakdown,
  onOpenLogOpenings,
}: SetHeaderProps) {
  // TCG sets have no reliable print run to sum (or estimate a default for),
  // so their first stat box shows a plain checklist-row count instead, and
  // the print-run-based "Set Completion" bar below doesn't apply at all.
  const isTcg = category === "TCG";
  const chasesInSetLabel = isTcg ? "Chase Cards" : "Chases in Set";
  const chasesInSetValue = isTcg ? totalCardsInSet : totalPrintRunInSet;

  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="w-full rounded-2xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm overflow-hidden"
    >
      {/* ── Top Band ─────────────────────────────────────────────────── */}
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600" />

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">

          {/* ── Set Info ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb-style meta */}
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1.5">
              {year} &bull; {sport.toUpperCase()} &bull; {manufacturer}
            </p>

            {/* Set name */}
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4 truncate">
              {setName}
            </h1>

            {/* Stat pills row */}
            <div className="flex flex-wrap gap-2 mb-6">
              <StatPill label={chasesInSetLabel} value={chasesInSetValue} />
              <StatPill label="Chases Pulled" value={chasesPulled} />
              <StatPill label="Your Gels" value={userGelCount} />
            </div>

            {/* Progress bars */}
            <div className="space-y-4 max-w-lg">
              {!isTcg && (
                <ProgressBar
                  label="Set Completion"
                  value={chasesPulled}
                  max={totalPrintRunInSet}
                  color="bg-gradient-to-r from-blue-500 to-violet-500"
                />
              )}
              {totalChaseCardsInSet != null && totalChaseCardsInSet > 0 && (
                <ProgressBar
                  label="Chase Completion"
                  value={userGelCount}
                  max={totalChaseCardsInSet}
                  color="bg-gradient-to-r from-amber-400 to-orange-500"
                />
              )}
            </div>
          </div>

          {/* ── Set Image + Packs Opened ───────────────────────────────── */}
          <div className="shrink-0 flex flex-col sm:flex-row items-center sm:items-start gap-3 self-center md:self-start">
            {/* Always rendered so every set's banner has the same shape.
                Curated only by the developer, directly in the database —
                see prisma/set-image.ts — there is no in-app upload control. */}
            <div className="relative shrink-0 w-40 h-40 md:w-52 md:h-52 rounded-lg overflow-hidden border border-slate-600/50 shadow-lg shadow-black/40 bg-slate-900/60">
              {setImageUrl ? (
                <Image
                  src={setImageUrl}
                  alt={`${setName} set image`}
                  fill
                  sizes="(max-width: 768px) 160px, 208px"
                  preload
                  className="object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-700/60 text-slate-600">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    className="w-7 h-7"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span className="text-[10px] uppercase tracking-wider font-medium">
                    No Image
                  </span>
                </div>
              )}
            </div>

            {/* "X Packs/Boxes Opened" + its two linked popups */}
            <div className="flex flex-col items-center gap-2 w-40 md:w-44">
              <div className="w-full flex flex-col items-center gap-0.5 px-3 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <span className="text-xl font-bold text-white tabular-nums">
                  {packsOpenedValue.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium text-center">
                  {packsOpenedLabel}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenBreakdown}
                className="flex items-center gap-0.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors duration-150"
              >
                See full breakdown
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-snug">
                Did you open this set?{" "}
                <button
                  type="button"
                  onClick={onOpenLogOpenings}
                  className="text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors"
                >
                  Log it here
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
