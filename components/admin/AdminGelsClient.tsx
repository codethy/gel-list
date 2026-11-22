// components/admin/AdminGelsClient.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { playerSubtitle } from "@/components/set-detail/ChecklistTable";
import type { AdminGelEntry, AdminGelFilters, ReviewQueuePage } from "@/lib/data/adminGels";
import AdminEditGelModal from "./AdminEditGelModal";

// One text filter per thing an admin might search by — see AdminGelFilters
// in lib/data/adminGels.ts for what each maps to. Order mirrors how an
// admin would narrow a search: which set, which card, then who/where/how
// it was obtained.
const FILTER_FIELDS: { key: keyof AdminGelFilters; label: string; placeholder: string }[] = [
  { key: "setName",       label: "Set",                 placeholder: "e.g. 2026 Topps Royalty Tennis" },
  { key: "playerName",    label: "Player / Character",  placeholder: "e.g. Lionel Messi" },
  { key: "variationName", label: "Variation Name",      placeholder: "e.g. Warp Speed" },
  { key: "parallel",      label: "Parallel",            placeholder: "e.g. Gold" },
  { key: "printRun",      label: "Print Run",           placeholder: "e.g. 99" },
  { key: "username",      label: "Username",            placeholder: "Logged by..." },
  { key: "pulledBy",      label: "Who Pulled It",       placeholder: "Breaker or influencer" },
  { key: "location",      label: "Location",            placeholder: "City or country" },
  { key: "product",       label: "Which Product",       placeholder: "e.g. Blaster Box" },
  { key: "purchaseLocation", label: "Where was it bought", placeholder: "e.g. Walmart, Topps.com" },
  { key: "notes",         label: "Notes",                placeholder: "Search notes..." },
];

function hasAnyFilter(filters: AdminGelFilters): boolean {
  return Object.values(filters).some((v) => v && v.trim());
}

const ACQUISITION_LABELS: Record<string, string> = {
  PULLED:       "Pulled",
  BOUGHT:       "Bought",
  BREAKER:      "Breaker",
  EBAY:         "eBay",
  MARKETING_PROMOTION: "Marketing Promotion",
  SOCIAL_MEDIA: "Social Media",
  INFLUENCER:   "Influencer",
  OTHER:        "Others",
};

type Tab = "UNVERIFIED" | "VERIFIED";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function GelRow({
  gel,
  onVerify,
  onReject,
  onDelete,
  onEdit,
  busy,
}: {
  gel: AdminGelEntry;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (gel: AdminGelEntry) => void;
  busy: boolean;
}) {
  const subtitle = playerSubtitle(gel.checklistCard);
  const image = gel.cardFrontImageUrl ?? gel.cardBackImageUrl;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
      <div className="shrink-0">
        {image ? (
          <Image src={image} alt="" width={40} height={56} className="w-10 h-14 object-cover rounded-sm border border-slate-700/50" />
        ) : (
          <div className="w-10 h-14 rounded-sm border border-slate-700/40 bg-slate-800/60" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-semibold text-slate-200 truncate">{gel.checklistCard.playerName}</p>
          <span
            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              gel.isInHand
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            }`}
          >
            {gel.isInHand ? "My Own Gel" : "Someone Else's Gel"}
          </span>
        </div>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        <p className="text-[11px] text-slate-500 mt-1">
          <span className="text-slate-400">{gel.setName}</span>
          {" · "}
          Logged by <span className="text-slate-400">{gel.loggedByDisplayName ?? gel.loggedByUsername}</span>
          {" · "}
          {formatDate(gel.createdAt)}
          {gel.serialNumber != null && <> · #{gel.serialNumber}</>}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {gel.acquisitionMethod
            ? (gel.isInHand ? "How: " : "Where: ") +
              (ACQUISITION_LABELS[gel.acquisitionMethod] ?? gel.acquisitionMethod) +
              (gel.seller ? ` from ${gel.seller}` : "") +
              (gel.breakerName ? ` — ${gel.breakerName}` : "") +
              (gel.influencerHandle ? ` — ${gel.influencerHandle}` : "")
            : null}
        </p>
        {gel.notes && (
          <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={gel.notes}>
            &ldquo;{gel.notes}&rdquo;
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {gel.isVerified ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            Verified
          </span>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onVerify(gel.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(gel.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
            >
              False
            </button>
          </div>
        )}
        <div className="flex gap-3 mt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit(gel)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium disabled:opacity-40 transition-colors"
          >
            Edit
          </button>
          {gel.isVerified && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(gel.id)}
              className="text-[11px] text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4 border-t border-slate-800/60">
      <p className="text-xs text-slate-500 tabular-nums">
        Showing{" "}
        <span className="text-slate-300 font-medium">
          {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
        </span>{" "}
        of <span className="text-slate-300 font-medium">{total.toLocaleString()}</span> gels
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300 tabular-nums font-medium">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-700/50 text-slate-300 hover:bg-slate-800/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function AdminGelsClient({ initialPage }: { initialPage: ReviewQueuePage }) {
  const [tab, setTab]                   = useState<Tab>("UNVERIFIED");
  const [data, setData]                 = useState<ReviewQueuePage>(initialPage);
  const [filterInputs, setFilterInputs] = useState<AdminGelFilters>({});
  const [activeFilters, setActiveFilters] = useState<AdminGelFilters>({});
  const [loading, setLoading]           = useState(false);
  const [busyId, setBusyId]             = useState<string | null>(null);
  const [editingGel, setEditingGel]     = useState<AdminGelEntry | null>(null);

  const fetchPage = useCallback(async (nextTab: Tab, nextFilters: AdminGelFilters, nextPage: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: nextTab, page: String(nextPage) });
      for (const field of FILTER_FIELDS) {
        const value = nextFilters[field.key]?.trim();
        if (value) params.set(field.key, value);
      }
      const res = await fetch(`/api/admin/gels?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleTabChange = useCallback((nextTab: Tab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    void fetchPage(nextTab, activeFilters, 1);
  }, [tab, activeFilters, fetchPage]);

  const handleFilterFieldChange = useCallback((key: keyof AdminGelFilters, value: string) => {
    setFilterInputs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const applyFilters = useCallback(() => {
    setActiveFilters(filterInputs);
    void fetchPage(tab, filterInputs, 1);
  }, [tab, filterInputs, fetchPage]);

  const handleFilterKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    applyFilters();
  }, [applyFilters]);

  const clearFilters = useCallback(() => {
    setFilterInputs({});
    setActiveFilters({});
    void fetchPage(tab, {}, 1);
  }, [tab, fetchPage]);

  const handlePageChange = useCallback((nextPage: number) => {
    void fetchPage(tab, activeFilters, nextPage);
  }, [tab, activeFilters, fetchPage]);

  const removeGelLocally = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      gels:  prev.gels.filter((g) => g.id !== id),
      total: Math.max(0, prev.total - 1),
    }));
  }, []);

  const handleVerify = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY" }),
      });
      // A verified gel no longer belongs in "Not Verified" — dropping it
      // here is what makes it "move" to the Verified tab; it'll be there
      // (freshly fetched, so already reflecting isVerified: true) the next
      // time that tab is opened.
      if (res.ok) removeGelLocally(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to verify");
    } finally {
      setBusyId(null);
    }
  }, [removeGelLocally]);

  const handleReject = useCallback(async (id: string) => {
    if (!confirm("Mark this gel as false? It will be permanently removed.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FALSE" }),
      });
      if (res.ok) removeGelLocally(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to reject");
    } finally {
      setBusyId(null);
    }
  }, [removeGelLocally]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this gel permanently?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}`, { method: "DELETE" });
      if (res.ok) removeGelLocally(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }, [removeGelLocally]);

  const handleEditSuccess = useCallback(() => {
    setEditingGel(null);
    // Edits never touch isVerified (see app/api/admin/gels/[gelId]/route.ts),
    // so the gel always stays on the current tab/page — just refresh it to
    // reflect whatever fields changed, simplest-correct over hand-patching.
    void fetchPage(tab, activeFilters, data.page);
  }, [tab, activeFilters, data.page, fetchPage]);

  const rowProps = {
    onVerify: handleVerify,
    onReject: handleReject,
    onDelete: handleDelete,
    onEdit:   setEditingGel,
    busy:     busyId !== null,
  };

  return (
    <div className="space-y-5">
      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-800">
        {([
          ["UNVERIFIED", "Not Verified"],
          ["VERIFIED", "Verified"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => handleTabChange(value)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === value
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {FILTER_FIELDS.map((field) => (
            <div key={field.key}>
              <label htmlFor={`gel-filter-${field.key}`} className="block text-[11px] font-medium text-slate-500 mb-1">
                {field.label}
              </label>
              <input
                id={`gel-filter-${field.key}`}
                type="text"
                value={filterInputs[field.key] ?? ""}
                onChange={(e) => handleFilterFieldChange(field.key, e.target.value)}
                onKeyDown={handleFilterKeyDown}
                placeholder={field.placeholder}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={applyFilters}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 transition-colors"
          >
            Apply Filters
          </button>
          {hasAnyFilter(filterInputs) && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── List ─────────────────────────────────────────────────────── */}
      {data.gels.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          {loading ? "Loading…" : hasAnyFilter(activeFilters) ? "No gels match these filters." : "Nothing here."}
        </p>
      ) : (
        <div className={`space-y-2 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {data.gels.map((gel) => (
            <GelRow key={gel.id} gel={gel} {...rowProps} />
          ))}
        </div>
      )}

      <Pagination
        page={data.page}
        pageSize={data.pageSize}
        total={data.total}
        totalPages={data.totalPages}
        onPageChange={handlePageChange}
      />

      <AdminEditGelModal
        gel={editingGel}
        onClose={() => setEditingGel(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
