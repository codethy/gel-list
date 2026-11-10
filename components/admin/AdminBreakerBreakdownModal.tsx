// components/admin/AdminBreakerBreakdownModal.tsx
//
// Popup shown when an admin clicks a breaker's name on /admin/breaker-
// profiles — their attributed products-opened and gels-hit counts, nested
// category -> subcategory -> set (only sets with >=1 attributed opening
// are shown). Fetches on open from
// app/api/admin/breaker-profiles/[id]/breakdown/route.ts.

"use client";

import { useEffect, useState } from "react";

interface BreakerBreakdown {
  categories: {
    category:      string;
    categoryLabel: string;
    subcategories: {
      subCategoryId:    string;
      subCategoryLabel: string;
      sets: {
        setId:         string;
        setName:       string;
        gelsHitCount:  number;
        oneOfOneCount: number;
        products:      { label: string; totalQuantity: number }[];
      }[];
    }[];
  }[];
}

export default function AdminBreakerBreakdownModal({
  breaker,
  onClose,
}: {
  breaker: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const [data, setData]     = useState<BreakerBreakdown | null>(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    if (!breaker) {
      setData(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setError(false);
    fetch(`/api/admin/breaker-profiles/${breaker.id}/breakdown`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [breaker]);

  if (!breaker) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-white">{breaker.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <p className="text-sm text-red-400">Couldn&apos;t load this breaker&apos;s breakdown.</p>}

        {!error && !data && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {data && data.categories.length === 0 && (
          <p className="text-sm text-slate-500">No attributed openings or gels yet.</p>
        )}

        {data && data.categories.length > 0 && (
          <div className="space-y-5">
            {data.categories.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{cat.categoryLabel}</h3>
                <div className="space-y-3">
                  {cat.subcategories.map((sub) => (
                    <div key={sub.subCategoryId}>
                      <p className="text-[11px] font-medium text-slate-500 mb-1.5">{sub.subCategoryLabel}</p>
                      <div className="space-y-2">
                        {sub.sets.map((set) => (
                          <div key={set.setId} className="rounded-xl border border-slate-700/50 bg-slate-800/40 px-4 py-3">
                            <p className="text-sm font-medium text-slate-200 mb-2">{set.setName}</p>

                            {set.products.length > 0 && (
                              <div className="mb-2">
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Products Opened</p>
                                <div className="flex flex-col gap-0.5 text-xs text-slate-400">
                                  {set.products.map((p) => (
                                    <span key={p.label}>{p.label}: {p.totalQuantity.toLocaleString()} opened</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div>
                              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Gels</p>
                              <div className="flex flex-col gap-0.5 text-xs text-slate-400">
                                <span>{set.gelsHitCount.toLocaleString()} gels hit</span>
                                <span>{set.oneOfOneCount.toLocaleString()} 1/1s hit</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
