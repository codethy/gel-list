// components/admin/AdminChecklistImageModal.tsx
//
// Sets or clears one checklist row's admin-curated default image — shown
// in the public checklist table until a real logged gel's own photo is
// available (which takes precedence). Reuses the same upload pipeline
// (UploadThing, via ImageUploadField) the Log a Gel form already uses.

"use client";

import { useEffect, useState } from "react";
import { ImageUploadField } from "@/components/set-detail/AddGelModal";
import type { AdminChecklistCard } from "@/lib/data/adminChecklist";

interface AdminChecklistImageModalProps {
  card:     AdminChecklistCard | null;
  onClose:  () => void;
  onSubmit: (imageUrl: string | null) => Promise<string | void>;
}

export default function AdminChecklistImageModal({ card, onClose, onSubmit }: AdminChecklistImageModalProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    setImageUrl(card.imageUrl ?? "");
    setError(null);
  }, [card]);

  if (!card) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(imageUrl || null);
    setSubmitting(false);
    if (result) setError(result);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Default Image</h2>
        <p className="text-xs text-slate-400 mb-5">
          {card.cardNumber} — {card.playerName}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ImageUploadField label="Card Image" value={imageUrl} onChange={setImageUrl} />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
