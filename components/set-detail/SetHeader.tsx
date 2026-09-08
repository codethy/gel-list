// components/set-detail/SetHeader.tsx

"use client";

import { motion } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SetHeaderProps {
  setName: string;
  sport: string;
  year: number;
  manufacturer: string;
  totalCardsInSet: number;
  totalChaseCardsInSet?: number | null;
  userGelCount: number;         // how many cards this user has gelled
  cardsOpenedCount: number;     // how many cards the user has opened from this set
  setImageUrl?: string | null;
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
  sport,
  year,
  manufacturer,
  totalCardsInSet,
  totalChaseCardsInSet,
  userGelCount,
  cardsOpenedCount,
  setImageUrl,
}: SetHeaderProps) {
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
        <div className="flex flex-col md:flex-row md:items-start gap-6">

          {/* ── Set Image (if available) ─────────────────────────────── */}
          {setImageUrl && (
            <div className="shrink-0 w-20 h-28 md:w-24 md:h-32 rounded-lg overflow-hidden border border-slate-600/50 shadow-lg shadow-black/40">
              <img
                src={setImageUrl}
                alt={`${setName} set image`}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* ── Set Info ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {/* Breadcrumb-style meta */}
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1.5">
              {year} &bull; {sport} &bull; {manufacturer}
            </p>

            {/* Set name */}
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4 truncate">
              {setName}
            </h1>

            {/* Stat pills row */}
            <div className="flex flex-wrap gap-2 mb-6">
              <StatPill label="Cards in Set" value={totalCardsInSet} />
              {totalChaseCardsInSet != null && (
                <StatPill label="Chase Cards" value={totalChaseCardsInSet} />
              )}
              <StatPill label="Cards Opened" value={cardsOpenedCount} />
              <StatPill label="Gels Logged" value={userGelCount} />
            </div>

            {/* Progress bars */}
            <div className="space-y-4 max-w-lg">
              <ProgressBar
                label="Set Completion"
                value={userGelCount}
                max={totalCardsInSet}
                color="bg-gradient-to-r from-blue-500 to-violet-500"
              />
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
        </div>
      </div>
    </motion.div>
  );
}
