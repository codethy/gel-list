// components/admin/AdminAboutClient.tsx
//
// Editor for the About Us page's header+copy blocks — add, edit, delete,
// and reorder (up/down, same swap-and-PATCH convention as
// AdminHomepageClient's featured-set reordering). Each block has an
// optional "Header" and a required "Copy" — see app/about/page.tsx for
// how these render on the public page.

"use client";

import { useState } from "react";
import type { AboutUsSection } from "@/lib/data/aboutUs";

interface Draft {
  heading: string;
  body:    string;
}

function toDraft(section: AboutUsSection): Draft {
  return { heading: section.heading ?? "", body: section.body };
}

export default function AdminAboutClient({ initialSections }: { initialSections: AboutUsSection[] }) {
  const [sections, setSections] = useState<AboutUsSection[]>(initialSections);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(
    Object.fromEntries(initialSections.map((s) => [s.id, toDraft(s)]))
  );
  const [busyId, setBusyId]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [newHeading, setNewHeading] = useState("");
  const [newBody, setNewBody]       = useState("");
  const [adding, setAdding]         = useState(false);

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function isDirty(section: AboutUsSection): boolean {
    const d = drafts[section.id];
    if (!d) return false;
    return d.heading !== (section.heading ?? "") || d.body !== section.body;
  }

  async function handleSave(section: AboutUsSection) {
    const d = drafts[section.id];
    if (!d || !d.body.trim()) {
      setError("Copy is required.");
      return;
    }
    setBusyId(section.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/about/${section.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ heading: d.heading, body: d.body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSections((prev) => prev.map((s) => (s.id === section.id ? data.section : s)));
      setDrafts((prev) => ({ ...prev, [section.id]: toDraft(data.section) }));
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this section permanently?")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/about/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        return;
      }
      setSections((prev) => prev.filter((s) => s.id !== id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const index = sections.findIndex((s) => s.id === id);
    if (index === -1) return;
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sections.length) return;

    const reordered = [...sections];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setSections(reordered); // optimistic
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/about/reorder", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
      });
      const data = await res.json();
      if (res.ok) setSections(data.sections);
    } finally {
      setBusyId(null);
    }
  }

  async function handleAdd() {
    if (!newBody.trim()) {
      setError("Copy is required.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/about", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ heading: newHeading || null, body: newBody }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add section.");
        return;
      }
      setSections((prev) => [...prev, data.section]);
      setDrafts((prev) => ({ ...prev, [data.section.id]: toDraft(data.section) }));
      setNewHeading("");
      setNewBody("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {sections.length === 0 && (
        <p className="text-sm text-slate-500 italic">No sections yet — add one below.</p>
      )}

      <div className="flex flex-col gap-3">
        {sections.map((section, i) => {
          const draft = drafts[section.id] ?? toDraft(section);
          const dirty = isDirty(section);
          const busy  = busyId === section.id;
          return (
            <div key={section.id} className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Section {i + 1}
                </p>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(section.id, "up")}
                    disabled={i === 0 || busy}
                    aria-label="Move up"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 15l-6-6-6 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(section.id, "down")}
                    disabled={i === sections.length - 1 || busy}
                    aria-label="Move down"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(section.id)}
                    disabled={busy}
                    aria-label="Delete section"
                    className="w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Header (optional)
                </label>
                <input
                  value={draft.heading}
                  onChange={(e) => updateDraft(section.id, { heading: e.target.value })}
                  placeholder="e.g. What is Gel Cards?"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Copy
                </label>
                <textarea
                  value={draft.body}
                  onChange={(e) => updateDraft(section.id, { body: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500 resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => handleSave(section)}
                  disabled={!dirty || busy}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
                >
                  {busy ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add new section ──────────────────────────────────────────── */}
      <div className="rounded-xl bg-slate-800/40 border border-dashed border-slate-700/60 p-4 space-y-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Add a new section
        </p>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Header (optional)
          </label>
          <input
            value={newHeading}
            onChange={(e) => setNewHeading(e.target.value)}
            placeholder="e.g. Why we built this"
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Copy
          </label>
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            placeholder="Section copy..."
            className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/50 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-500 resize-y"
          />
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !newBody.trim()}
            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
          >
            {adding ? "Adding..." : "+ Add Section"}
          </button>
        </div>
      </div>
    </div>
  );
}
