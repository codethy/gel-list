// components/profile/AllGelsGrid.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { GelCard } from "@/components/set-detail/YourGels";
import { CardImageModal, type CardImageTarget } from "@/components/set-detail/ChecklistTable";
import type { UserGelEntry } from "@/lib/data/profile";

export default function AllGelsGrid({ gels }: { gels: UserGelEntry[] }) {
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);

  if (gels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2 rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30">
        <p className="text-sm text-slate-500">No gels logged yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {gels.map((gel, i) => (
          <div key={gel.id} className="flex flex-col gap-1.5">
            <GelCard gel={gel} index={i} onOpenImage={setImageTarget} />
            <Link
              href={`/sets/${gel.cardSetId}`}
              className="text-[11px] text-slate-500 hover:text-slate-300 truncate text-center transition-colors"
            >
              {gel.setName}
            </Link>
          </div>
        ))}
      </div>

      <CardImageModal target={imageTarget} onClose={() => setImageTarget(null)} />
    </>
  );
}
