// components/admin/AdminEqlTrackerClient.tsx
//
// /admin/eql-tracker — table of sets currently enrolled in the EQL
// Tracker (Set Name / # of options / Edit / Remove), plus a search box
// (same flat /api/sets query AdminHomepageClient.tsx already issues, no
// category filter) to enroll a new set. Picking a search result or
// clicking "Edit" opens AdminEqlSetModal to configure that drop's options.

"use client";

import { useEffect, useState } from "react";
import AdminEqlSetModal, { type EqlSetModalTarget } from "./AdminEqlSetModal";
import type { EqlSetListRow, EqlProductInput } from "@/lib/data/eqlTracker";

interface SearchResultSet {
  id: string;
  name: string;
  year: number;
}

export default function AdminEqlTrackerClient({ initialSets }: { initialSets: EqlSetListRow[] }) {
  const [sets, setSets] = useState<EqlSetListRow[]>(initialSets);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultSet[]>([]);
  const [searching, setSearching] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalTarget, setModalTarget] = useState<EqlSetModalTarget | null>(null);

  const enrolledCardSetIds = new Set(sets.map((s) => s.cardSetId));

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ search: trimmed, limit: "20", withPrintRun: "false" });
        const res = await fetch(`/api/sets?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setResults(data.sets);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleModalSubmit(products: EqlProductInput[]): Promise<string | void> {
    if (!modalTarget) return;

    const url = modalTarget.mode === "create" ? "/api/admin/eql-sets" : `/api/admin/eql-sets/${modalTarget.eqlSetId}`;
    const method = modalTarget.mode === "create" ? "POST" : "PATCH";
    const body =
      modalTarget.mode === "create" ? { cardSetId: modalTarget.cardSetId, products } : { products };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return data.error ?? "Failed to save";

    const saved: EqlSetListRow = data.set;
    setSets((prev) =>
      modalTarget.mode === "create"
        ? [...prev, saved].sort((a, b) => a.setName.localeCompare(b.setName))
        : prev.map((s) => (s.id === saved.id ? saved : s))
    );
    setModalTarget(null);
    if (modalTarget.mode === "create") {
      setQuery("");
      setResults([]);
    }
  }

  async function handleDelete(set: EqlSetListRow) {
    if (!confirm(`Remove the EQL drop for "${set.setName}"? Every logged result for it will be deleted too.`)) return;

    setDeletingId(set.id);
    try {
      const res = await fetch(`/api/admin/eql-sets/${set.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to remove this EQL drop");
        return;
      }
      setSets((prev) => prev.filter((s) => s.id !== set.id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-slate-700/50 mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Set Name</th>
              <th className="px-4 py-3">Options</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s) => (
              <tr key={s.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-200">{s.setName}</td>
                <td className="px-4 py-3 text-slate-400">{s.productCount}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => setModalTarget({ mode: "edit", eqlSetId: s.id, setName: s.setName })}
                      className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-800/60 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      className="px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      {deletingId === s.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sets.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                  No sets enrolled yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Enroll a Set</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sets by name..."
        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 transition-colors mb-3"
      />

      {searching ? (
        <p className="text-sm text-slate-500">Searching…</p>
      ) : query.trim() && results.length === 0 ? (
        <p className="text-sm text-slate-500 italic">No matching sets found.</p>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
          {results.map((set) => {
            const already = enrolledCardSetIds.has(set.id);
            return (
              <div key={set.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{set.name}</p>
                  <p className="text-[11px] text-slate-500">{set.year}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalTarget({ mode: "create", cardSetId: set.id, setName: set.name })}
                  disabled={already}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  {already ? "Enrolled" : "+ Add"}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <AdminEqlSetModal target={modalTarget} onClose={() => setModalTarget(null)} onSubmit={handleModalSubmit} />
    </div>
  );
}
