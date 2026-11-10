// components/admin/AdminBreakerProfilesClient.tsx
//
// Table of all breaker profiles — Name / Country / Official Topps Partner
// (Y/N). "+ Add Breaker" creates a new one; per-row Edit/Remove modify or
// delete an existing one; clicking a name opens its attribution breakdown.

"use client";

import { useState } from "react";
import AdminBreakerProfileModal, { type BreakerProfileInput } from "./AdminBreakerProfileModal";
import AdminBreakerBreakdownModal from "./AdminBreakerBreakdownModal";
import type { BreakerProfileRow } from "@/lib/data/breakerProfiles";

export default function AdminBreakerProfilesClient({
  initialProfiles,
}: {
  initialProfiles: BreakerProfileRow[];
}) {
  const [profiles, setProfiles] = useState<BreakerProfileRow[]>(initialProfiles);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BreakerProfileRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [breakdownTarget, setBreakdownTarget] = useState<{ id: string; name: string } | null>(null);

  const handleSubmit = async (input: BreakerProfileInput): Promise<string | void> => {
    const url    = editing ? `/api/admin/breaker-profiles/${editing.id}` : "/api/admin/breaker-profiles";
    const method = editing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to save";

    if (editing) {
      setProfiles((prev) => prev.map((p) => (p.id === editing.id ? data.profile : p)).sort((a, b) => a.name.localeCompare(b.name)));
    } else {
      setProfiles((prev) => [...prev, data.profile].sort((a, b) => a.name.localeCompare(b.name)));
    }
    setModalOpen(false);
    setEditing(null);
  };

  const handleDelete = async (profile: BreakerProfileRow) => {
    if (!confirm(`Remove breaker profile "${profile.name}"? Their logged gels stay, just unlinked from this profile.`)) return;

    setDeletingId(profile.id);
    try {
      const res = await fetch(`/api/admin/breaker-profiles/${profile.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete breaker profile");
        return;
      }
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-400">
          Breaker profiles created here can be attributed to opened products and selected in the Log a Gel flow.
        </p>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shrink-0"
        >
          + Add Breaker
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Official Topps Partner</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setBreakdownTarget({ id: p.id, name: p.name })}
                    className="text-slate-200 font-medium hover:text-blue-400 transition-colors text-left"
                  >
                    {p.name}
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-400">{p.country}</td>
                <td className="px-4 py-3 text-slate-400">{p.isOfficialToppsPartner ? "Y" : "N"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => { setEditing(p); setModalOpen(true); }}
                      className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deletingId === p.id}
                      className="px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      {deletingId === p.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {profiles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No breaker profiles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminBreakerProfileModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={handleSubmit}
        editing={editing}
      />

      <AdminBreakerBreakdownModal
        breaker={breakdownTarget}
        onClose={() => setBreakdownTarget(null)}
      />
    </div>
  );
}
