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
import type { ClaimPrefill, CoOwnPrefill } from "./AddGelModal";

interface RecentPullsProps {
  gels: GelEntry[];
  // "Claim this card" in the image popup — see AddGelModal's claimPrefill.
  onClaimGel?: (prefill: ClaimPrefill) => void;
  // "..." menu's "Did you buy/pull this?" in the image popup — see
  // AddGelModal's coOwnPrefill.
  onCoOwnClaim?: (prefill: CoOwnPrefill) => void;
}

export default function RecentPulls({ gels, onClaimGel, onCoOwnClaim }: RecentPullsProps) {
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);

  if (gels.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-white">Recent Pulls</h2>

      <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {gels.map((gel, i) => (
          <GelCard key={gel.id} gel={gel} index={i} onOpenImage={setImageTarget} />
        ))}
      </motion.div>

      <CardImageModal target={imageTarget} onClose={() => setImageTarget(null)} onClaim={onClaimGel} onCoOwnClaim={onCoOwnClaim} />
    </section>
  );
}
