// components/admin/AdminAdjustOpenedModal.tsx
//
// Small prompt for the "Add"/"Minus" buttons next to a product's "Opened"
// count in AdminProductsClient.tsx — asks for a positive whole number,
// then hands it back to the caller (which already knows whether this was
// an add or a remove) to apply via
// app/api/admin/sets/[id]/products/[productId]/opened/route.ts.

"use client";

import { useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import BreakerSearch, { type BreakerOption } from "@/components/BreakerSearch";
import type { AdminProductRow } from "@/lib/data/adminChecklist";

interface AdminAdjustOpenedModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSubmit: (amount: number, breakerProfileId: string | null) => Promise<string | void>;
  product:  AdminProductRow | null;
  mode:     "add" | "remove";
  breakers: BreakerOption[];
}

export default function AdminAdjustOpenedModal({ isOpen, onClose, onSubmit, product, mode, breakers }: AdminAdjustOpenedModalProps) {
  const [amount, setAmount]         = useState("");
  const [breakerName, setBreakerName]           = useState("");
  const [breakerProfileId, setBreakerProfileId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  if (!isOpen || !product) return null;

  const parsed = Number(amount);
  const canSubmit = amount.trim() !== "" && Number.isInteger(parsed) && parsed > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(parsed, mode === "add" ? (breakerProfileId || null) : null);
    setSubmitting(false);
    if (result) {
      setError(result);
    } else {
      setAmount("");
      setBreakerName("");
      setBreakerProfileId("");
    }
  }

  function handleClose() {
    setAmount("");
    setBreakerName("");
    setBreakerProfileId("");
    setError(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">
          {mode === "add" ? "Add" : "Remove"} Opened — {product.label}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          {mode === "add"
            ? `How many more ${product.label} units were opened?`
            : `How many ${product.label} units should no longer count as opened?`}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2"
              autoFocus
            />
          </div>

          {mode === "add" && (
            <div>
              <Label>Breaker (optional)</Label>
              <BreakerSearch
                value={breakerName}
                breakerProfileId={breakerProfileId}
                onChange={(name, id) => { setBreakerName(name); setBreakerProfileId(id); }}
                options={breakers}
                placeholder="Leave blank if not from a breaker..."
              />
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : mode === "add" ? "Add" : "Remove"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
