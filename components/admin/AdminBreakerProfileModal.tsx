// components/admin/AdminBreakerProfileModal.tsx
//
// Create-or-edit form for a BreakerProfile — Name, Country, and whether
// they're an Official Topps Partner, all required before creation. Used
// by AdminBreakerProfilesClient for both "+ Add Breaker" and per-row Edit.

"use client";

import { useEffect, useState } from "react";
import { Label, Input } from "@/components/set-detail/AddGelModal";
import type { BreakerProfileRow } from "@/lib/data/breakerProfiles";

export interface BreakerProfileInput {
  name: string;
  country: string;
  isOfficialToppsPartner: boolean;
}

interface AdminBreakerProfileModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSubmit: (input: BreakerProfileInput) => Promise<string | void>;
  editing:  BreakerProfileRow | null;
}

export default function AdminBreakerProfileModal({ isOpen, onClose, onSubmit, editing }: AdminBreakerProfileModalProps) {
  const [name, setName]       = useState("");
  const [country, setCountry] = useState("");
  const [isPartner, setIsPartner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(editing?.name ?? "");
    setCountry(editing?.country ?? "");
    setIsPartner(editing?.isOfficialToppsPartner ?? false);
    setError(null);
  }, [isOpen, editing]);

  if (!isOpen) return null;

  const canSubmit = name.trim() !== "" && country.trim() !== "" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit({ name: name.trim(), country: country.trim(), isOfficialToppsPartner: isPartner });
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-5">{editing ? "Edit Breaker" : "Add Breaker"}</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. @username, breaker's name..." autoFocus />
          </div>

          <div>
            <Label>Country *</Label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. United States" />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isPartner}
              onChange={(e) => setIsPartner(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500"
            />
            Official Topps Partner
          </label>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
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
              {submitting ? "Saving..." : editing ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
