// components/admin/AdminProductPacksModal.tsx
//
// Manages one product's pack kinds — how many packs are in a single unit
// of this product, and how many cards are in each pack. Most products only
// need one row; "+ Add Pack Kind" covers products that bundle more than
// one kind of pack (e.g. a box with both base packs and bonus packs of a
// different size). Powers the set page's "X Packs/Boxes Opened" total —
// see lib/data/productOpenings.ts.

"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import type { AdminPackKind, AdminProductRow } from "@/lib/data/adminChecklist";

interface PackKindForm {
  packsCount:   string;
  cardsPerPack: string;
}

function toForm(kinds: AdminPackKind[]): PackKindForm[] {
  return kinds.length > 0
    ? kinds.map((k) => ({ packsCount: String(k.packsCount), cardsPerPack: String(k.cardsPerPack) }))
    : [{ packsCount: "", cardsPerPack: "" }];
}

interface AdminProductPacksModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSubmit: (packKinds: { packsCount: number; cardsPerPack: number }[]) => Promise<string | void>;
  product:  AdminProductRow | null;
}

export default function AdminProductPacksModal({ isOpen, onClose, onSubmit, product }: AdminProductPacksModalProps) {
  const [kinds, setKinds]           = useState<PackKindForm[]>([{ packsCount: "", cardsPerPack: "" }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !product) return;
    setKinds(toForm(product.packKinds));
    setError(null);
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  function updateKind(index: number, field: keyof PackKindForm, value: string) {
    setKinds((prev) => prev.map((k, i) => (i === index ? { ...k, [field]: value } : k)));
  }

  function removeKind(index: number) {
    setKinds((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function addKind() {
    setKinds((prev) => [...prev, { packsCount: "", cardsPerPack: "" }]);
  }

  const canSubmit = kinds.every((k) => k.packsCount.trim() !== "" && k.cardsPerPack.trim() !== "") && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(
      kinds.map((k) => ({ packsCount: Number(k.packsCount), cardsPerPack: Number(k.cardsPerPack) }))
    );
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Edit Packs — {product.label}</h2>
        <p className="text-xs text-slate-400 mb-5">
          How many packs are in one {product.label}, and how many cards are in each pack?
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {kinds.map((kind, i) => (
              <div key={i} className="flex items-end gap-2 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <div className="flex-1">
                  <Label>{kinds.length > 1 ? `Pack Kind ${i + 1} — Packs` : "Number of Packs"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={kind.packsCount}
                    onChange={(e) => updateKind(i, "packsCount", e.target.value)}
                    placeholder="e.g. 24"
                  />
                </div>
                <div className="flex-1">
                  <Label>Cards per Pack</Label>
                  <Input
                    type="number"
                    min={1}
                    value={kind.cardsPerPack}
                    onChange={(e) => updateKind(i, "cardsPerPack", e.target.value)}
                    placeholder="e.g. 8"
                  />
                </div>
                {kinds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeKind(i)}
                    aria-label="Remove this pack kind"
                    className="shrink-0 p-2 text-red-400/80 hover:text-red-400 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addKind}
            className="self-start text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            + Add a different kind of pack
          </button>

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
              disabled={!canSubmit}
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
