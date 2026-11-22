// components/admin/AdminMissingChecklistCardsClient.tsx
//
// /admin/missing-checklist-cards — a manually-curated backlog of cards
// the admin knows exist but haven't been added to a set's checklist yet.
// "Missing"/"Resolved" tabs (same convention as AdminGelsClient.tsx's Gel
// Review Queue), plus an "Add a Missing Card" section: search across all
// sets by name (same /api/sets query AdminEqlTrackerClient.tsx already
// issues) to pick which set, then type in that card's own details — the
// card itself isn't in any checklist yet, so there's nothing to search
// for there.

"use client";

import { useEffect, useState } from "react";
import type { MissingChecklistCardRow } from "@/lib/data/missingChecklistCards";

interface SearchResultSet {
  id: string;
  name: string;
  year: number;
}

type Tab = "MISSING" | "RESOLVED";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function AdminMissingChecklistCardsClient({
  initialCards,
}: {
  initialCards: MissingChecklistCardRow[];
}) {
  const [tab, setTab] = useState<Tab>("MISSING");
  const [cards, setCards] = useState<MissingChecklistCardRow[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultSet[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSet, setSelectedSet] = useState<SearchResultSet | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [team, setTeam] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/missing-checklist-cards?status=${tab}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { cards: MissingChecklistCardRow[] }) => {
        if (!cancelled) setCards(data.cards);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

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

  async function handleToggleResolved(card: MissingChecklistCardRow) {
    setBusyId(card.id);
    try {
      const res = await fetch(`/api/admin/missing-checklist-cards/${card.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isResolved: !card.isResolved }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to update");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(card: MissingChecklistCardRow) {
    if (!confirm(`Remove "${card.playerName}" (${card.cardNumber}) from the backlog?`)) return;

    setBusyId(card.id);
    try {
      const res = await fetch(`/api/admin/missing-checklist-cards/${card.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Failed to delete");
        return;
      }
      setCards((prev) => prev.filter((c) => c.id !== card.id));
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSet || !cardNumber.trim() || !playerName.trim()) return;

    setSubmitting(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/missing-checklist-cards", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          cardSetId:  selectedSet.id,
          cardNumber: cardNumber.trim(),
          playerName: playerName.trim(),
          team:       team.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add");
        return;
      }
      if (tab === "MISSING") {
        setCards((prev) => [...prev, data.card as MissingChecklistCardRow]);
      }
      setSelectedSet(null);
      setQuery("");
      setResults([]);
      setCardNumber("");
      setPlayerName("");
      setTeam("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-800/80 mb-4">
        {(["MISSING", "RESOLVED"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? "border-blue-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "MISSING" ? "Missing" : "Resolved"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-700/50 mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/60 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="px-4 py-3">Set</th>
              <th className="px-4 py-3">Card #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">{tab === "MISSING" ? "Flagged" : "Resolved"}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                <td className="px-4 py-3 text-slate-200">{c.setName}</td>
                <td className="px-4 py-3 text-slate-300 font-mono">{c.cardNumber}</td>
                <td className="px-4 py-3 text-slate-200">{c.playerName}</td>
                <td className="px-4 py-3 text-slate-400">{c.team ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">
                  {formatDate(tab === "MISSING" ? c.createdAt : (c.resolvedAt ?? c.createdAt))}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end items-center gap-2">
                    <button
                      onClick={() => handleToggleResolved(c)}
                      disabled={busyId === c.id}
                      className="px-3 py-1.5 rounded-lg border border-slate-700/50 text-xs text-slate-300 hover:bg-slate-800/60 transition-colors disabled:opacity-40"
                    >
                      {tab === "MISSING" ? "Mark Resolved" : "Reopen"}
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={busyId === c.id}
                      className="px-3 py-1.5 rounded-lg border border-red-900/50 text-xs text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && cards.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  {tab === "MISSING" ? "No missing cards flagged." : "Nothing resolved yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Add a Missing Card ──────────────────────────────────────── */}
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Add a Missing Card</p>

      {!selectedSet ? (
        <>
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
              {results.map((set) => (
                <div key={set.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300 truncate">{set.name}</p>
                    <p className="text-[11px] text-slate-500">{set.year}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSet(set)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors shrink-0"
                  >
                    Pick
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-3 max-w-md p-4 rounded-xl bg-slate-800/40 border border-slate-700/40">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-200">
              <span className="text-slate-500">Set:</span> {selectedSet.name}
            </p>
            <button
              type="button"
              onClick={() => setSelectedSet(null)}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Change
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Card Number</label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="e.g. DA-SN"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Card Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Puka Nacua / Matthew Stafford"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Team (optional)</label>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="e.g. Los Angeles Rams"
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 transition-colors"
            />
          </div>

          {addError && <p className="text-xs text-red-400">{addError}</p>}

          <button
            type="submit"
            disabled={submitting || !cardNumber.trim() || !playerName.trim()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Adding..." : "Add to Backlog"}
          </button>
        </form>
      )}
    </div>
  );
}
