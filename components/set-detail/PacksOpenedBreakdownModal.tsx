// components/set-detail/PacksOpenedBreakdownModal.tsx
//
// "See full breakdown" popup for the set header's "X Packs/Boxes Opened"
// box — restates the set-wide total, then one row per product (everyone's
// total, plus the viewer's own count), and the viewer's own grand total.
// See lib/data/productOpenings.ts for how these numbers are computed.

"use client";

import type { SetPacksOpenedSummary } from "@/lib/data/productOpenings";

interface PacksOpenedBreakdownModalProps {
  isOpen:  boolean;
  onClose: () => void;
  summary: SetPacksOpenedSummary;
}

export default function PacksOpenedBreakdownModal({ isOpen, onClose, summary }: PacksOpenedBreakdownModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Packs Opened Breakdown</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center gap-1 px-5 py-4 rounded-xl bg-slate-800/60 border border-slate-700/50 mb-5">
          <span className="text-3xl font-bold text-white tabular-nums">
            {summary.totalPacksOpened.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400 uppercase tracking-wider font-medium">
            {summary.label}
          </span>
        </div>

        {summary.products.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            No products have been added to this set&apos;s catalog yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2 mb-5">
            {summary.products.map((p) => (
              <div
                key={p.setProductId}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-800/40 border border-slate-700/40"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    {p.totalQuantity.toLocaleString()} {p.pluralLabel} Opened
                  </p>
                  {p.ownQuantity > 0 && (
                    <p className="text-xs text-slate-500 mt-0.5">You: {p.ownQuantity.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {summary.ownTotalPacksOpened > 0 && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span className="text-sm text-blue-300 font-medium">Your Total</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {summary.ownTotalPacksOpened.toLocaleString()} {summary.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
