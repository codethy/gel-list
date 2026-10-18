// components/admin/AdminAddProductModal.tsx
//
// Add-products form for a set's product catalog — a checkbox list so the
// admin can select every product this set was released in at once, used by
// components/admin/AdminProductsClient.tsx.

"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import { PRODUCT_TYPE_OPTIONS } from "@/lib/productTypes";

export interface ProductSelection {
  productType: string;
  productTypeOther: string;
}

interface AdminAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selections: ProductSelection[]) => Promise<string | void>;
  // Product types already in this set's catalog — shown checked and
  // disabled, since adding the same (non-"Other") type again is a no-op.
  existingProductTypes: Set<string>;
}

export default function AdminAddProductModal({
  isOpen,
  onClose,
  onSubmit,
  existingProductTypes,
}: AdminAddProductModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [otherLabel, setOtherLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setChecked(new Set());
    setOtherLabel("");
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (value: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const isOtherChecked = checked.has("OTHER");
  const canSubmit =
    checked.size > 0 && (!isOtherChecked || otherLabel.trim() !== "") && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    const selections: ProductSelection[] = [...checked].map((productType) => ({
      productType,
      productTypeOther: productType === "OTHER" ? otherLabel.trim() : "",
    }));
    const result = await onSubmit(selections);
    setSubmitting(false);
    if (result) setError(result);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">Add Products</h2>
        <p className="text-xs text-slate-400 mb-5">Check every product this set was released in.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {PRODUCT_TYPE_OPTIONS.map((o) => {
              const alreadyAdded = o.value !== "OTHER" && existingProductTypes.has(o.value);
              return (
                <label
                  key={o.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm transition-colors ${
                    alreadyAdded
                      ? "border-slate-800 text-slate-600 cursor-not-allowed"
                      : "border-slate-700/50 text-slate-200 hover:border-slate-600 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={alreadyAdded || checked.has(o.value)}
                    disabled={alreadyAdded}
                    onChange={() => toggle(o.value)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500 disabled:opacity-50"
                  />
                  {o.label}
                  {alreadyAdded && <span className="ml-auto text-[11px] text-slate-600">Already added</span>}
                </label>
              );
            })}
          </div>

          {isOtherChecked && (
            <div>
              <Label>&quot;Other&quot; Label</Label>
              <Input
                value={otherLabel}
                onChange={(e) => setOtherLabel(e.target.value)}
                placeholder="e.g. Walmart Exclusive Box"
              />
            </div>
          )}

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
              {submitting ? "Adding..." : `Add${checked.size > 0 ? ` (${checked.size})` : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
