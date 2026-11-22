// components/admin/AdminPurchaseLocationsClient.tsx
//
// "Where did you buy the product?" options section, shown below Products
// on app/admin/sets/[id]/checklist/page.tsx — add/remove the per-set
// labels that populate that dropdown in the Log a Gel form (own gel,
// "Pulled" only). Auto-seeded with sensible defaults the first time this
// set's list is needed (see lib/data/purchaseLocations.ts); every change
// here is a plain add/remove from then on.

"use client";

import { useState } from "react";
import type { PurchaseLocationRow } from "@/lib/data/purchaseLocations";

interface AdminPurchaseLocationsClientProps {
  setId: string;
  initialLocations: PurchaseLocationRow[];
}

export default function AdminPurchaseLocationsClient({ setId, initialLocations }: AdminPurchaseLocationsClientProps) {
  const [locations, setLocations] = useState<PurchaseLocationRow[]>(initialLocations);
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(location: PurchaseLocationRow) {
    if (!confirm(`Remove "${location.label}" from this set's purchase-location options?`)) return;

    setRemovingId(location.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/purchase-locations/${location.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to remove option");
        return;
      }
      setLocations((prev) => prev.filter((l) => l.id !== location.id));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sets/${setId}/purchase-locations`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ label }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to add option");
        return;
      }
      setLocations((prev) => [...prev, data.location as PurchaseLocationRow]);
      setNewLabel("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-10">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Purchase Locations</h2>
        <p className="text-sm text-slate-400">
          Options for &quot;Where did you buy the product?&quot; — shown when logging your own gel as Pulled.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {locations.map((location) => (
          <span
            key={location.id}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-slate-900/40 text-sm text-slate-200"
          >
            {location.label}
            <button
              type="button"
              onClick={() => handleRemove(location)}
              disabled={removingId === location.id}
              aria-label={`Remove ${location.label}`}
              className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {locations.length === 0 && (
          <p className="text-sm text-slate-500 italic">No options yet.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2 max-w-sm">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="e.g. Walgreens"
          className="flex-1 px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
        />
        <button
          type="submit"
          disabled={submitting || !newLabel.trim()}
          className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
