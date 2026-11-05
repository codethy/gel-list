// components/admin/AdminEditGelModal.tsx
//
// The Gel Review Queue's "Edit" action — a thin wrapper around the exact
// same Log a Gel form a user would see (components/set-detail/
// AddGelModal.tsx), so its fields automatically stay aligned with that
// form forever: this file never duplicates field markup/validation, it
// only (1) adapts an AdminGelEntry into the GelEntry shape AddGelModal's
// `editingGel` prop expects, (2) fetches the gel's own set's category/
// year/product catalog (AddGelModal needs these as plain props, and the
// Review Queue is flat across every set, unlike a single set's own page),
// and (3) points submission at the admin PATCH route (no ownership check,
// doesn't touch isVerified) via AddGelModal's `editSubmitUrl` prop.

"use client";

import { useEffect, useState } from "react";
import AddGelModal, { type ProductOption } from "@/components/set-detail/AddGelModal";
import type { GelEntry } from "@/components/set-detail/YourGels";
import type { DuplicateFlag } from "@/components/set-detail/ChecklistTable";
import type { AdminGelEntry } from "@/lib/data/adminGels";

function adaptToGelEntry(gel: AdminGelEntry): GelEntry {
  return {
    id:                gel.id,
    cardTemplateId:    gel.checklistCard.id,
    isInHand:          gel.isInHand,
    isVerified:        gel.isVerified,
    duplicateFlag:     gel.duplicateFlag as DuplicateFlag,
    serialNumber:      gel.serialNumber,
    hitYear:           gel.hitYear,
    hitMonth:          gel.hitMonth,
    hitCity:           gel.hitCity,
    hitCountry:        gel.hitCountry,
    cardFrontImageUrl: gel.cardFrontImageUrl,
    cardBackImageUrl:  gel.cardBackImageUrl,
    acquisitionMethod: gel.acquisitionMethod,
    seller:            gel.seller,
    breakerName:       gel.breakerName,
    notes:             gel.notes,
    productType:       gel.productType,
    productTypeOther:  gel.productTypeOther,
    userId:            gel.userId,
    cardTemplate: {
      cardNumber:    gel.checklistCard.cardNumber,
      playerName:    gel.checklistCard.playerName,
      cardType:      gel.checklistCard.cardType,
      cardTier:      gel.checklistCard.cardTier,
      parallelType:  gel.checklistCard.parallelType,
      printRun:      gel.checklistCard.printRun,
      variationName: gel.checklistCard.variationName,
      team:          gel.checklistCard.team,
    },
  };
}

interface SetEditContext {
  category: string;
  year:     number;
  products: ProductOption[];
}

export default function AdminEditGelModal({
  gel,
  onClose,
  onSuccess,
}: {
  gel: AdminGelEntry | null;
  onClose: () => void;
  onSuccess: (updated: { id: string; isInHand: boolean }) => void;
}) {
  const [context, setContext]   = useState<SetEditContext | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!gel) {
      setContext(null);
      setLoadError(false);
      return;
    }
    let cancelled = false;
    setContext(null);
    setLoadError(false);
    fetch(`/api/admin/sets/${gel.setId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setContext({ category: data.category, year: data.year, products: data.products });
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gel?.id, gel?.setId]);

  if (!gel) return null;

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/60 p-6 text-center space-y-3">
          <p className="text-sm text-red-400">Couldn&apos;t load this gel&apos;s set details.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-600/50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </div>
    );
  }

  return (
    <AddGelModal
      isOpen
      onClose={onClose}
      onSuccess={(updatedGel) => onSuccess({ id: updatedGel.id, isInHand: updatedGel.isInHand ?? true })}
      setId={gel.setId}
      category={context.category}
      setYear={context.year}
      products={context.products}
      editingGel={adaptToGelEntry(gel)}
      editSubmitUrl={`/api/admin/gels/${gel.id}`}
    />
  );
}
