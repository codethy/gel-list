// components/profile/ProfileFavorites.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { GelCard } from "@/components/set-detail/YourGels";
import { CardImageModal, type CardImageTarget } from "@/components/set-detail/ChecklistTable";
import ManageFavoritesModal from "./ManageFavoritesModal";
import type { FavoriteGelEntry, UserGelEntry } from "@/lib/data/profile";

interface ProfileFavoritesProps {
  initialFavorites: FavoriteGelEntry[];
  allGels:          UserGelEntry[];
  maxFavorites:     number;
}

export default function ProfileFavorites({ initialFavorites, allGels, maxFavorites }: ProfileFavoritesProps) {
  const [favorites, setFavorites] = useState<FavoriteGelEntry[]>(initialFavorites);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [imageTarget, setImageTarget] = useState<CardImageTarget | null>(null);

  async function handleAdd(gel: UserGelEntry) {
    setBusyId(gel.id);
    try {
      const res = await fetch("/api/profile/favorites", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ portfolioCardId: gel.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFavorites(data.favorites);
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(portfolioCardId: string) {
    setBusyId(portfolioCardId);
    try {
      const res = await fetch(`/api/profile/favorites/${portfolioCardId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFavorites(data.favorites);
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(portfolioCardId: string, direction: "up" | "down") {
    const index = favorites.findIndex((f) => f.id === portfolioCardId);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= favorites.length) return;

    const reordered = [...favorites];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setFavorites(reordered); // optimistic
    setBusyId(portfolioCardId);

    try {
      const res = await fetch("/api/profile/favorites/reorder", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderedPortfolioCardIds: reordered.map((f) => f.id) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setFavorites(data.favorites);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">Favorite Gels</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-600/50 hover:border-slate-500/60 transition-all duration-150"
          >
            {favorites.length === 0 ? "Choose Favorite Gels" : "Manage Favorites"}
          </button>
          <Link
            href="/profile/gels"
            className="flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors duration-150"
          >
            See All Your Gels
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3 rounded-xl border border-dashed border-slate-700/60 bg-slate-900/30">
          <p className="text-sm text-slate-500 max-w-xs">
            Pick up to {maxFavorites} gels from your collection to show off here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {favorites.map((gel, i) => (
            <GelCard key={gel.id} gel={gel} index={i} onOpenImage={setImageTarget} />
          ))}
        </div>
      )}

      <ManageFavoritesModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        allGels={allGels}
        favorites={favorites}
        maxFavorites={maxFavorites}
        busyId={busyId}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onMove={handleMove}
      />

      <CardImageModal target={imageTarget} onClose={() => setImageTarget(null)} />
    </section>
  );
}
