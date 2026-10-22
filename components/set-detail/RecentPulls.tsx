// components/set-detail/RecentPulls.tsx
//
// A live feed of the most recently logged gels across EVERY user for this
// set — both own gels and "someone else's gel" reports. Shown above "Your
// Gels". Same card format (reuses GelCard), minus the "Add Gel" button and
// view-only (no edit/delete — those only make sense for a gel's owner,
// from "Your Gels").

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GelCard, type GelEntry } from "./YourGels";
import { CardImageModal, type CardImageTarget } from "./ChecklistTable";

interface RecentPullsProps {
  gels: GelEntry[];
}

export default function RecentPulls({ gels }: RecentPullsProps) {
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);

  if (gels.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-white">Recent Pulls</h2>
        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-500/30">
          {gels.length}
        </span>
      </div>

      <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {gels.map((gel, i) => (
          <GelCard key={gel.id} gel={gel} index={i} onOpenImage={setImageTarget} />
        ))}
      </motion.div>

      <CardImageModal target={imageTarget} onClose={() => setImageTarget(null)} />
    </section>
  );
}
