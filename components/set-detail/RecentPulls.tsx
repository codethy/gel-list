// components/set-detail/RecentPulls.tsx
//
// A live feed of the most recently logged gels across EVERY user for this
// set — both own gels and "someone else's gel" reports. Shown above "Your
// Gels". Same card format (reuses GelCard) — view-only for everyone else's
// entries and the viewer's own owned gels (those are edited from "Your
// Gels" instead), but the viewer's own "someone else's gel" reports get
// edit/delete here too, for as long as they're still visible in this feed
// (capped at RECENT_PULLS_LIMIT) — there's no other page that lists them.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
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
  // Edit/delete for the viewer's own "someone else's gel" entries — see
  // the file comment above. Omit to make every card view-only.
  onEditGel?: (gel: GelEntry) => void;
  onDeleteGel?: (gelId: string) => Promise<void>;
}

export default function RecentPulls({ gels, onClaimGel, onCoOwnClaim, onEditGel, onDeleteGel }: RecentPullsProps) {
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);
  const { data: session } = useSession();

  if (gels.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-white">Recent Pulls</h2>

      <motion.div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {gels.map((gel, i) => {
          const isOwnSighting = gel.isInHand === false && gel.userId === session?.user?.id;
          return (
            <GelCard
              key={gel.id}
              gel={gel}
              index={i}
              onOpenImage={setImageTarget}
              onEdit={isOwnSighting ? onEditGel : undefined}
              onDelete={isOwnSighting ? onDeleteGel : undefined}
            />
          );
        })}
      </motion.div>

      <CardImageModal target={imageTarget} onClose={() => setImageTarget(null)} onClaim={onClaimGel} onCoOwnClaim={onCoOwnClaim} />
    </section>
  );
}
