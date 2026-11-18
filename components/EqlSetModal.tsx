// components/EqlSetModal.tsx
//
// Pop-up shown when a visitor clicks a set's name on /eql-tracker.
// Fetches the set's full EQL detail on open (app/api/eql-sets/[id]/route.ts).
// Left column: set name + banner (same square, object-contain dimensions
// as the home page's SetCard.tsx, so the whole image always shows).
// Right column: always-visible Selected/Not Selected totals, estimated
// boxes available + boxes won, and the Track form — every option is
// listed at once, each with its own quantity + Selected/Not Selected
// result, so one "Track" submission can cover several options in one go.
// A "Log History" button at the top widens the panel to reveal a third
// column with the full Selected/Not Selected log. No sign-in required —
// the typed name is remembered in localStorage so it can be suggested
// again next time.

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import type { UserEqlStats } from "@/lib/data/eqlTracker";

interface EqlProductRow {
  id: string;
  label: string;
  maxQuantity: number;
  estimatedPrintRun: number | null;
}

interface EqlLogEntry {
  id: string;
  name: string;
  quantity: number;
  productLabel: string;
  createdAt: string;
}

interface EqlSetDetail {
  id: string;
  setName: string;
  setImageUrl: string | null;
  products: EqlProductRow[];
  successCount: number;
  failCount: number;
  boxesWon: number;
  successLog: EqlLogEntry[];
  failedLog: EqlLogEntry[];
}

interface RowState {
  quantity: string;
  status: "SUCCESS" | "FAILED" | "";
}

const NAME_STORAGE_KEY = "eqlTrackerName";

function blankRows(products: EqlProductRow[]): Record<string, RowState> {
  return Object.fromEntries(products.map((p) => [p.id, { quantity: "", status: "" as const }]));
}

export default function EqlSetModal({
  eqlSetId,
  onClose,
  onResultLogged,
}: {
  eqlSetId: string | null;
  onClose: () => void;
  // Called with the submitter's freshly-updated aggregate stats right
  // after a successful Track submission — lets EqlTrackerClient update
  // "Your EQL History" live, without the visitor needing to refresh.
  onResultLogged?: (stats: UserEqlStats) => void;
}) {
  const { data: session } = useSession();

  const [detail, setDetail] = useState<EqlSetDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [logTab, setLogTab] = useState<"SUCCESS" | "FAILED">("SUCCESS");

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!eqlSetId) {
      setDetail(null);
      setLoadError(false);
      return;
    }

    let cancelled = false;
    setDetail(null);
    setLoadError(false);
    setShowLog(false);
    setLogTab("SUCCESS");
    setRows({});
    setFormError(null);

    const rememberedName = typeof window !== "undefined" ? localStorage.getItem(NAME_STORAGE_KEY) : null;
    setName(rememberedName ?? session?.user?.name ?? "");

    fetch(`/api/eql-sets/${eqlSetId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { detail: EqlSetDetail }) => {
        if (cancelled) return;
        setDetail(data.detail);
        setRows(blankRows(data.detail.products));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eqlSetId]);

  if (!eqlSetId) return null;

  function updateRow(productId: string, field: keyof RowState, value: string) {
    setRows((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  }

  function toggleStatus(productId: string, status: "SUCCESS" | "FAILED") {
    setRows((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], status: prev[productId]?.status === status ? "" : status },
    }));
  }

  const products = detail?.products ?? [];
  const anySelected = products.some((p) => (rows[p.id]?.status ?? "") !== "");
  const allValid = products.every((p) => {
    const r = rows[p.id] ?? { quantity: "", status: "" as const };
    if (r.status === "") return true;
    const q = Number(r.quantity);
    return Number.isInteger(q) && q >= 1 && q <= p.maxQuantity;
  });
  const canSubmit = detail !== null && name.trim() !== "" && anySelected && allValid && !submitting;

  async function handleTrack(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !detail) return;

    const entries = products
      .map((p) => ({ eqlProductId: p.id, quantity: Number(rows[p.id]?.quantity), status: rows[p.id]?.status }))
      .filter((e): e is { eqlProductId: string; quantity: number; status: "SUCCESS" | "FAILED" } => e.status === "SUCCESS" || e.status === "FAILED");

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/eql-sets/${detail.id}/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "Failed to track this result");
        return;
      }

      localStorage.setItem(NAME_STORAGE_KEY, name.trim());
      setDetail(data.detail);
      setRows(blankRows(data.detail.products));
      setLogTab("SUCCESS");
      if (data.userStats) onResultLogged?.(data.userStats);
    } finally {
      setSubmitting(false);
    }
  }

  const printRunProducts = products.filter((p) => p.estimatedPrintRun != null);
  const activeLog = logTab === "SUCCESS" ? detail?.successLog : detail?.failedLog;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className={`w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6 transition-[max-width] duration-300 ease-out ${
          showLog ? "max-w-4xl" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {loadError && <p className="text-sm text-red-400">Couldn&apos;t load this EQL drop.</p>}

        {!loadError && !detail && (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}

        {detail && (
          <>
            <div className="flex items-center justify-between gap-3 mb-4">
              <button
                type="button"
                onClick={() => setShowLog((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                  showLog ? "bg-blue-600 border-blue-500 text-white" : "border-slate-700/50 text-slate-300 hover:border-slate-500"
                }`}
              >
                Log History
              </button>
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

            <div className="flex items-start gap-6">
              {/* ── Left: name + banner, same square/object-contain dimensions as SetCard.tsx ── */}
              <div className="w-40 shrink-0 flex flex-col gap-2">
                <h2 className="text-base font-bold text-white leading-tight">{detail.setName}</h2>
                <div className="relative w-full aspect-square bg-[#1a1a1a] rounded-lg flex items-center justify-center border border-slate-700/50 overflow-hidden">
                  {detail.setImageUrl ? (
                    <Image src={detail.setImageUrl} alt={`${detail.setName} banner`} fill sizes="160px" className="object-contain" />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-zinc-700">
                      <rect x="2" y="3" width="14" height="20" rx="2" />
                      <path d="M8 21h8a2 2 0 002-2V7l-5-5H8a2 2 0 00-2 2" />
                    </svg>
                  )}
                </div>
              </div>

              {/* ── Middle: stats + Track form ── */}
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3">
                    <p className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">Selected</p>
                    <p className="text-xl font-bold text-white tabular-nums">{detail.successCount.toLocaleString()}</p>
                  </div>
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-4 py-3">
                    <p className="text-[11px] font-semibold text-red-500 uppercase tracking-wider">Not Selected</p>
                    <p className="text-xl font-bold text-white tabular-nums">{detail.failCount.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Estimated Boxes Available</p>
                  {printRunProducts.length > 0 ? (
                    <div className="flex flex-col gap-0.5 text-sm text-slate-300 mb-1.5">
                      {printRunProducts.map((p) => (
                        <span key={p.id}>{p.estimatedPrintRun!.toLocaleString()} {p.label}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic mb-1.5">Not provided</p>
                  )}
                  <p className="text-sm text-slate-300">
                    <span className="text-slate-500">Boxes Won in EQL: </span>
                    <span className="font-semibold">{detail.boxesWon.toLocaleString()}</span>
                  </p>
                </div>

                <form onSubmit={handleTrack} className="flex flex-col gap-3 p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
                  {products.map((p) => {
                    const row = rows[p.id] ?? { quantity: "", status: "" as const };
                    const quantityNum = Number(row.quantity);
                    const quantityValid = Number.isInteger(quantityNum) && quantityNum >= 1 && quantityNum <= p.maxQuantity;
                    return (
                      <div key={p.id} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-700/40">
                        <p className="text-sm font-semibold text-slate-200">{p.label}</p>

                        <div>
                          <Label>Number of {p.label}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={p.maxQuantity}
                            value={row.quantity}
                            onChange={(e) => updateRow(p.id, "quantity", e.target.value)}
                            placeholder={`1–${p.maxQuantity}`}
                          />
                          {row.status !== "" && row.quantity.trim() !== "" && !quantityValid && (
                            <p className="text-xs text-red-400 mt-1">Must be between 1 and {p.maxQuantity}.</p>
                          )}
                        </div>

                        <div>
                          <Label>Result</Label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleStatus(p.id, "SUCCESS")}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                row.status === "SUCCESS"
                                  ? "bg-emerald-600 border-emerald-500 text-white"
                                  : "border-slate-700/50 text-emerald-400 hover:border-emerald-500/60"
                              }`}
                            >
                              Selected
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleStatus(p.id, "FAILED")}
                              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                                row.status === "FAILED"
                                  ? "bg-red-600 border-red-500 text-white"
                                  : "border-slate-700/50 text-red-400 hover:border-red-500/60"
                              }`}
                            >
                              Not Selected
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div>
                    <Label>Your Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Jane"
                      maxLength={100}
                    />
                  </div>

                  {formError && <p className="text-xs text-red-400">{formError}</p>}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="px-4 py-2.5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Tracking..." : "Track"}
                  </button>
                </form>
              </div>

              {/* ── Right: Log History, only when toggled open ── */}
              {showLog && (
                <div className="w-64 shrink-0 border-l border-slate-800 pl-5 flex flex-col gap-3">
                  <div className="flex items-center gap-2 border-b border-slate-800">
                    <button
                      type="button"
                      onClick={() => setLogTab("SUCCESS")}
                      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        logTab === "SUCCESS" ? "border-emerald-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogTab("FAILED")}
                      className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                        logTab === "FAILED" ? "border-red-500 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      Not Selected
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[32rem]">
                    {activeLog && activeLog.length === 0 && (
                      <p className="text-sm text-slate-500 italic">No results logged yet.</p>
                    )}
                    {activeLog?.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40 text-sm">
                        <span className="text-slate-200 truncate">{entry.name}</span>
                        <span className="text-slate-400 shrink-0">{entry.quantity} {entry.productLabel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
