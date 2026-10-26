// components/admin/AdminSetHeader.tsx
//
// Title/subtitle block for /admin/sets/[id]/checklist, plus the "Edit Set
// Details" button and modal — editing the CardSet itself (name, year,
// brand, category, subcategory, description), not its checklist rows.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminEditSetModal, { type AdminSetDetails } from "./AdminEditSetModal";

export default function AdminSetHeader({
  set,
  cardCount,
}: {
  set:       AdminSetDetails;
  cardCount: number;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSubmit(values: {
    name: string; year: number; brand: string; category: string; subCategory: string; description: string;
  }): Promise<string | void> {
    const res = await fetch(`/api/admin/sets/${set.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to save changes";

    setModalOpen(false);
    router.refresh();
  }

  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">{set.name}</h1>
        <p className="text-sm text-slate-400">
          {set.year} &bull; {set.brand} &bull; {cardCount.toLocaleString()} cards.
          Add, edit, or delete checklist rows to fix import mistakes.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="shrink-0 px-4 py-2 rounded-xl border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors"
      >
        Edit Set Details
      </button>

      <AdminEditSetModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        set={set}
      />
    </div>
  );
}
