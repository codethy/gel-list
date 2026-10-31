// components/admin/AdminChecklistClient.tsx
//
// Add/edit/delete table for one set's checklist, used by
// app/admin/sets/[id]/checklist/page.tsx.

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import AdminChecklistCardModal, {
  type ChecklistCardFormValues,
} from "./AdminChecklistCardModal";
import AdminChecklistImageModal from "./AdminChecklistImageModal";
import type { AdminChecklistCard, AdminChecklistMeta, PositionInstruction } from "@/lib/data/adminChecklist";

interface AdminChecklistClientProps {
  setId:               string;
  category:            string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  initialCards:        AdminChecklistCard[];
  initialMeta:         AdminChecklistMeta;
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
  initialMeta,
  cardCategoryOptions,
  cardTierOptions,
}: AdminChecklistClientProps) {
  const [cards, setCards]       = useState<AdminChecklistCard[]>(initialCards);
  const [meta, setMeta]         = useState<AdminChecklistMeta>(initialMeta);
  const [search, setSearch]     = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<AdminChecklistCard | null>(null);
  const [imageCard, setImageCard]     = useState<AdminChecklistCard | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [rowError, setRowError]       = useState<{ id: string; message: string } | null>(null);

  const playerColumnLabel = category === "SPORTS" ? "Player" : "Character";
  const showTeam          = category === "SPORTS";

  // Fetches one page of this set's checklist — used for pagination/search,
  // and to refresh the visible page after any create/edit/delete instead of
  // re-fetching (and re-rendering) the whole set every time. A ref holds
  // the most recent request's id so a slower, stale response (e.g. from a
  // search keystroke that's since been superseded) can't clobber a newer
  // one that already landed.
  const latestRequestId = useRef(0);
  const fetchPage = useCallback(async (page: number, searchValue: string) => {
    const requestId = ++latestRequestId.current;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), size: "50" });
      if (searchValue.trim()) params.set("search", searchValue.trim());
      const res = await fetch(`/api/admin/sets/${setId}/checklist?${params.toString()}`);
      if (!res.ok || requestId !== latestRequestId.current) return null;
      const data = await res.json();
      setCards(data.cards);
      setMeta(data.meta);
      return data.meta as AdminChecklistMeta;
    } finally {
      if (requestId === latestRequestId.current) setIsLoading(false);
    }
  }, [setId]);

  // Debounced search — resets to page 1 on every new query. Skips the
  // very first run so the SSR-provided initial page isn't immediately
  // re-fetched on mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      fetchPage(1, search);
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const refreshCurrentPage = useCallback(async () => {
    await fetchPage(meta.page, search);
  }, [fetchPage, meta.page, search]);

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
    notes:         values.notes.trim() || null,
  });

  const handleSubmit = async (
    values: ChecklistCardFormValues,
    position: PositionInstruction | null
  ): Promise<string | void> => {
    const body = { ...toApiBody(values), position };

    if (editingCard) {
      const res = await fetch(`/api/admin/sets/${setId}/checklist/${editingCard.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to save changes";
    } else {
      const res = await fetch(`/api/admin/sets/${setId}/checklist`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to add card";
    }

    // The route only hands back the one row it changed now (not the whole
    // set) — refresh just the page currently being viewed to reflect it,
    // whether that's this same row updated in place or a new/repositioned
    // row that may or may not land on the current page.
    await refreshCurrentPage();
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
      // Deleting a row can empty out the current page (e.g. deleting the
      // last row on the last page) — refetch, then step back one page if
      // that happened, rather than leaving an admin stranded on a blank page.
      const refreshed = await fetchPage(meta.page, search);
      if (refreshed && refreshed.page > refreshed.totalPages && refreshed.totalPages > 0) {
        await fetchPage(refreshed.totalPages, search);
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by number, name, parallel..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
          />
        </div>
        <button
          onClick={openAdd}
          className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + Add Card
        </button>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-slate-700/50">
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        )}
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
              <th className="px-4 py-3">Notes</th>
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
                      <Image src={c.imageUrl} alt="" width={40} height={40} className="w-full h-full object-cover" />
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
                <td className="px-4 py-3 text-slate-400 max-w-[180px] truncate" title={c.notes ?? undefined}>{c.notes ?? "—"}</td>
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
                <td colSpan={showTeam ? 10 : 9} className="px-4 py-8 text-center text-slate-500">
                  {search.trim() ? "No cards match your search." : "No cards in this checklist yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-slate-500 tabular-nums">
            Showing{" "}
            <span className="text-slate-300 font-medium">
              {(meta.page - 1) * meta.pageSize + 1}–{Math.min(meta.page * meta.pageSize, meta.total)}
            </span>{" "}
            of <span className="text-slate-300 font-medium">{meta.total.toLocaleString()}</span> cards
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchPage(meta.page - 1, search)}
              disabled={meta.page <= 1 || isLoading}
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              aria-label="Previous page"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 tabular-nums font-medium">
              {meta.page} / {meta.totalPages}
            </span>
            <button
              onClick={() => fetchPage(meta.page + 1, search)}
              disabled={meta.page >= meta.totalPages || isLoading}
              className="p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
              aria-label="Next page"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}

      <AdminChecklistCardModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSubmit={handleSubmit}
        editingCard={editingCard}
        playerColumnLabel={playerColumnLabel}
        showTeam={showTeam}
        cardCategoryOptions={cardCategoryOptions}
        cardTierOptions={cardTierOptions}
        setId={setId}
      />

      <AdminChecklistImageModal
        card={imageCard}
        onClose={() => setImageCard(null)}
        onSubmit={handleImageSubmit}
      />
    </div>
  );
}
