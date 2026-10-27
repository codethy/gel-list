// components/set-detail/LogProductOpeningsModal.tsx
//
// "Did you open this set? Log it here" popup — one quantity field per
// product in this set's catalog (kept in sync with the admin checklist
// page's Products section). Saving contributes to the set-wide "X
// Packs/Boxes Opened" total and this user's own breakdown — see
// lib/data/productOpenings.ts.
//
// ProductOpening also has an isBreak flag (for a future "hits pulled by
// breakers" report), but there's no UI for it here on purpose — it's an
// internal-only distinction for now, so every entry saved from this form
// is always isBreak: false.

"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import type { SetPacksOpenedSummary } from "@/lib/data/productOpenings";

export interface OpeningEntry {
  setProductId: string;
  quantity:     number;
  isBreak:      boolean;
}

interface LogProductOpeningsModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  products: SetPacksOpenedSummary["products"];
  onSubmit: (entries: OpeningEntry[]) => Promise<string | void>;
}

export default function LogProductOpeningsModal({
  isOpen,
  onClose,
  products,
  onSubmit,
}: LogProductOpeningsModalProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setQuantities(Object.fromEntries(products.map((p) => [p.setProductId, p.ownQuantity > 0 ? String(p.ownQuantity) : ""])));
    setError(null);
  }, [isOpen, products]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const entries: OpeningEntry[] = products.map((p) => ({
      setProductId: p.setProductId,
      quantity: Math.max(0, Math.round(Number(quantities[p.setProductId]) || 0)),
      isBreak: false,
    }));
    const result = await onSubmit(entries);
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Log Your Openings</h2>
        <p className="text-xs text-slate-400 mb-5">
          How many of each product did you open for this set?
        </p>

        {products.length === 0 ? (
          <>
            <p className="text-sm text-slate-500 text-center py-6">
              This set has no products in its catalog yet — check back once the admin adds some.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors"
            >
              Close
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {products.map((p) => (
              <div key={p.setProductId}>
                <Label>{p.label}</Label>
                <Input
                  type="number"
                  min={0}
                  value={quantities[p.setProductId] ?? ""}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [p.setProductId]: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
            ))}

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
        )}
      </div>
    </div>
  );
}
