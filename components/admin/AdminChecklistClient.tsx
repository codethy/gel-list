// components/admin/AdminChecklistClient.tsx
//
// Add/edit/delete table for one set's checklist, used by
// app/admin/sets/[id]/checklist/page.tsx.

"use client";

import { useState } from "react";
import AdminChecklistCardModal, {
  type ChecklistCardFormValues,
} from "./AdminChecklistCardModal";
import AdminChecklistImageModal from "./AdminChecklistImageModal";
import type { AdminChecklistCard } from "@/lib/data/adminChecklist";

interface AdminChecklistClientProps {
  setId:               string;
  category:            string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  initialCards:        AdminChecklistCard[];
  cardCategoryOptions: string[];
  cardTierOptions:     string[];
}

function cardLabel(c: AdminChecklistCard): string {
  const parts = [c.variationName, c.parallel].filter(Boolean);
  const suffix = c.printRun ? ` /${c.printRun}` : "";
  return parts.length > 0 ? `${parts.join(" ")}${suffix}` : (c.printRun ? `Base${suffix}` : "Base");
}

export default function AdminChecklistClient({
  setId,
  category,
  initialCards,
  cardCategoryOptions,
  cardTierOptions,
}: AdminChecklistClientProps) {
  const [cards, setCards]       = useState<AdminChecklistCard[]>(initialCards);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<AdminChecklistCard | null>(null);
  const [imageCard, setImageCard]     = useState<AdminChecklistCard | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [rowError, setRowError]       = useState<{ id: string; message: string } | null>(null);

  const playerColumnLabel = category === "SPORTS" ? "Player" : "Character";
  const showTeam          = category === "SPORTS";

  const openAdd  = () => { setEditingCard(null); setModalOpen(true); };
  const openEdit = (card: AdminChecklistCard) => { setEditingCard(card); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const toApiBody = (values: ChecklistCardFormValues) => ({
    cardNumber:    values.cardNumber.trim(),
    playerName:    values.playerName.trim(),
    team:          values.team.trim() || null,
    cardCategory:  values.cardCategory,
    cardTier:      values.cardTier,
    parallel:      values.parallel.trim() || null,
    printRun:      values.printRun.trim() === "" ? null : Number(values.printRun),
    variationName: values.variationName.trim() || null,
    isHit:         values.isHit,
  });

  const handleSubmit = async (values: ChecklistCardFormValues): Promise<string | void> => {
    const body = toApiBody(values);

    if (editingCard) {
      const res = await fetch(`/api/admin/sets/${setId}/checklist/${editingCard.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to save changes";

      setCards((prev) => prev.map((c) => (c.id === editingCard.id ? data.card : c)));
    } else {
      const res = await fetch(`/api/admin/sets/${setId}/checklist`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to add card";

      setCards((prev) => [...prev, data.card]);
    }

    setModalOpen(false);
  };

  const handleImageSubmit = async (imageUrl: string | null): Promise<string | void> => {
    if (!imageCard) return;
    const res = await fetch(`/api/admin/sets/${setId}/checklist/${imageCard.id}/image`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ imageUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to save image";

    setCards((prev) => prev.map((c) => (c.id === imageCard.id ? { ...c, imageUrl: data.card.imageUrl } : c)));
    setImageCard(null);
  };

  const handleDelete = async (card: AdminChecklistCard) => {
    if (!confirm(`Delete "${card.cardNumber} — ${card.playerName}"? This cannot be undone.`)) return;

    setDeletingId(card.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/checklist/${card.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowError({ id: card.id, message: data.error ?? "Failed to delete" });
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + Add Card
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">No.</th>
              <th className="px-4 py-3">{playerColumnLabel}</th>
              {showTeam && <th className="px-4 py-3">Team</th>}
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Parallel / Print Run</th>
              <th className="px-4 py-3">Hit</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setImageCard(c)}
                    className="w-10 h-10 rounded-md bg-slate-900/60 border border-slate-700/50 overflow-hidden flex items-center justify-center hover:border-slate-500 transition-colors shrink-0"
                    title="Set default image"
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-slate-300">{c.cardNumber}</td>
                <td className="px-4 py-3">
                  <p className="text-slate-200">{c.playerName}</p>
                  <p className="text-xs text-slate-500">{cardLabel(c)}</p>
                </td>
                {showTeam && <td className="px-4 py-3 text-slate-400">{c.team ?? "—"}</td>}
                <td className="px-4 py-3 text-slate-400">{c.cardCategory}</td>
                <td className="px-4 py-3 text-slate-400">{c.cardTier}</td>
                <td className="px-4 py-3 text-slate-400">
                  {c.parallel ?? "—"}{c.printRun ? ` /${c.printRun}` : ""}
                </td>
                <td className="px-4 py-3 text-slate-400">{c.isHit ? "Yes" : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => openEdit(c)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className="px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      {deletingId === c.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                  {rowError?.id === c.id && (
                    <p className="text-xs text-red-400 text-right mt-1.5 max-w-xs ml-auto">{rowError.message}</p>
                  )}
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={showTeam ? 9 : 8} className="px-4 py-8 text-center text-slate-500">
                  No cards in this checklist yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminChecklistCardModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        editingCard={editingCard}
        playerColumnLabel={playerColumnLabel}
        showTeam={showTeam}
        cardCategoryOptions={cardCategoryOptions}
        cardTierOptions={cardTierOptions}
      />

      <AdminChecklistImageModal
        card={imageCard}
        onClose={() => setImageCard(null)}
        onSubmit={handleImageSubmit}
      />
    </div>
  );
}
