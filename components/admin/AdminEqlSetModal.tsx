// components/admin/AdminEqlSetModal.tsx
//
// Configures one EQL drop's options — repeatable rows of {product type,
// max quantity per entry, optional estimated print run}, same add/remove-
// row shape as AdminProductPacksModal.tsx's pack-kind rows. Shared between
// "+ Add Set" (create mode — rows start blank) and per-row "Edit" (edit
// mode — fetches the existing rows, including each one's own logged-
// result count, from app/api/admin/eql-sets/[id]/route.ts on open).

"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import { PRODUCT_TYPE_OPTIONS } from "@/lib/productTypes";
import type { EqlProductInput, EqlAdminProductRow } from "@/lib/data/eqlTracker";

interface ProductRowForm {
  id?: string;
  productType: string;
  productTypeOther: string;
  maxQuantity: string;
  estimatedPrintRun: string;
  boxesPerCase: string;
  resultCount: number;
}

const BLANK_ROW: ProductRowForm = { productType: "", productTypeOther: "", maxQuantity: "", estimatedPrintRun: "", boxesPerCase: "", resultCount: 0 };

function toForm(products: EqlAdminProductRow[]): ProductRowForm[] {
  return products.length > 0
    ? products.map((p) => ({
        id: p.id,
        productType: p.productType,
        productTypeOther: p.productTypeOther ?? "",
        maxQuantity: String(p.maxQuantity),
        estimatedPrintRun: p.estimatedPrintRun != null ? String(p.estimatedPrintRun) : "",
        boxesPerCase: p.boxesPerCase != null ? String(p.boxesPerCase) : "",
        resultCount: p.resultCount,
      }))
    : [{ ...BLANK_ROW }];
}

export type EqlSetModalTarget =
  | { mode: "create"; cardSetId: string; setName: string }
  | { mode: "edit"; eqlSetId: string; setName: string };

interface AdminEqlSetModalProps {
  target: EqlSetModalTarget | null;
  onClose: () => void;
  onSubmit: (products: EqlProductInput[]) => Promise<string | void>;
}

export default function AdminEqlSetModal({ target, onClose, onSubmit }: AdminEqlSetModalProps) {
  const [rows, setRows] = useState<ProductRowForm[]>([{ ...BLANK_ROW }]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);

    if (target.mode === "create") {
      setRows([{ ...BLANK_ROW }]);
      setLoading(false);
      setLoadError(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    fetch(`/api/admin/eql-sets/${target.eqlSetId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { detail: { products: EqlAdminProductRow[] } }) => {
        if (cancelled) return;
        setRows(toForm(data.detail.products));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  function updateRow(index: number, field: keyof ProductRowForm, value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRow(index: number) {
    const row = rows[index];
    if (row.resultCount > 0) {
      const ok = confirm(
        `This option already has ${row.resultCount} logged result${row.resultCount === 1 ? "" : "s"}. Removing it will delete ${row.resultCount === 1 ? "that result" : "those results"} too. Continue?`
      );
      if (!ok) return;
    }
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...BLANK_ROW }]);
  }

  const canSubmit =
    rows.every(
      (r) =>
        r.productType !== "" &&
        (r.productType !== "OTHER" || r.productTypeOther.trim() !== "") &&
        r.maxQuantity.trim() !== "" &&
        Number.isInteger(Number(r.maxQuantity)) &&
        Number(r.maxQuantity) >= 1 &&
        (r.productType !== "CASE" ||
          (r.boxesPerCase.trim() !== "" && Number.isInteger(Number(r.boxesPerCase)) && Number(r.boxesPerCase) >= 1))
    ) && !submitting && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const products: EqlProductInput[] = rows.map((r) => ({
      id: r.id,
      productType: r.productType,
      productTypeOther: r.productType === "OTHER" ? r.productTypeOther.trim() : null,
      maxQuantity: Number(r.maxQuantity),
      estimatedPrintRun: r.estimatedPrintRun.trim() === "" ? null : Number(r.estimatedPrintRun),
      boxesPerCase: r.productType === "CASE" && r.boxesPerCase.trim() !== "" ? Number(r.boxesPerCase) : null,
    }));
    const result = await onSubmit(products);
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-1">
          {target.mode === "create" ? "Add EQL Drop" : "Edit EQL Drop"} — {target.setName}
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Add every option this drop offers (e.g. Hobby Box, Hobby Case), each option&apos;s own max quantity per entry, and an optional estimated print run. A Hobby Case option also needs how many boxes are in one case, so &quot;Boxes Won in EQL&quot; can be counted correctly.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-400">Couldn&apos;t load this drop&apos;s options.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <div key={i} className="flex flex-col gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Label>Product Type</Label>
                      <select
                        value={row.productType}
                        onChange={(e) => updateRow(i, "productType", e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
                      >
                        <option value="">Choose...</option>
                        {PRODUCT_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label="Remove this option"
                        className="shrink-0 p-2 text-red-400/80 hover:text-red-400 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {row.productType === "OTHER" && (
                    <div>
                      <Label>&quot;Other&quot; Label</Label>
                      <Input
                        value={row.productTypeOther}
                        onChange={(e) => updateRow(i, "productTypeOther", e.target.value)}
                        placeholder="e.g. Walmart Exclusive Box"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Max Quantity per Entry</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.maxQuantity}
                        onChange={(e) => updateRow(i, "maxQuantity", e.target.value)}
                        placeholder="e.g. 4"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Estimated Print Run</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.estimatedPrintRun}
                        onChange={(e) => updateRow(i, "estimatedPrintRun", e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  {row.productType === "CASE" && (
                    <div>
                      <Label>Boxes in 1 Hobby Case</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.boxesPerCase}
                        onChange={(e) => updateRow(i, "boxesPerCase", e.target.value)}
                        placeholder="e.g. 4"
                      />
                    </div>
                  )}

                  {row.resultCount > 0 && (
                    <p className="text-[11px] text-slate-500">{row.resultCount} result{row.resultCount === 1 ? "" : "s"} already logged for this option.</p>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRow}
              className="self-start text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              + Add Another Product
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
        )}
      </div>
    </div>
  );
}
