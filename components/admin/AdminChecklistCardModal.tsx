// components/admin/AdminChecklistCardModal.tsx
//
// Add/edit form for a single ChecklistCard row, used by
// components/admin/AdminChecklistClient.tsx. Reuses the same form
// primitives as the user-facing Add Gel modal for visual consistency.

"use client";

import { useEffect, useRef, useState } from "react";
import { Label, Input, Select, Textarea } from "@/components/set-detail/AddGelModal";
import type { AdminChecklistCard, PositionInstruction } from "@/lib/data/adminChecklist";

interface CardOption {
  id:         string;
  cardNumber: string;
  playerName: string;
}

export interface ChecklistCardFormValues {
  cardNumber:    string;
  playerName:    string;
  team:          string;
  cardCategory:  string;
  cardTier:      string;
  parallel:      string;
  printRun:      string;
  variationName: string;
  isHit:         boolean;
  notes:         string;
}

function emptyForm(defaultCategory: string, defaultTier: string): ChecklistCardFormValues {
  return {
    cardNumber:    "",
    playerName:    "",
    team:          "",
    cardCategory:  defaultCategory,
    cardTier:      defaultTier,
    parallel:      "",
    printRun:      "",
    variationName: "",
    isHit:         false,
    notes:         "",
  };
}

function toForm(card: AdminChecklistCard): ChecklistCardFormValues {
  return {
    cardNumber:    card.cardNumber,
    playerName:    card.playerName,
    team:          card.team ?? "",
    cardCategory:  card.cardCategory,
    cardTier:      card.cardTier,
    parallel:      card.parallel ?? "",
    printRun:      card.printRun != null ? String(card.printRun) : "",
    variationName: card.variationName ?? "",
    isHit:         card.isHit,
    notes:         card.notes ?? "",
  };
}

interface AdminChecklistCardModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  // returns an error message, or nothing on success
  onSubmit: (values: ChecklistCardFormValues, position: PositionInstruction | null) => Promise<string | void>;
  editingCard:         AdminChecklistCard | null;
  playerColumnLabel:   string; // "Player" (Sports) or "Character" (Entertainment/TCG)
  showTeam:            boolean;
  cardCategoryOptions: string[];
  cardTierOptions:     string[];
  setId:               string; // for searching the checklist to position against
}

export default function AdminChecklistCardModal({
  isOpen,
  onClose,
  onSubmit,
  editingCard,
  playerColumnLabel,
  showTeam,
  cardCategoryOptions,
  cardTierOptions,
  setId,
}: AdminChecklistCardModalProps) {
  const [form, setForm]           = useState<ChecklistCardFormValues>(() =>
    editingCard ? toForm(editingCard) : emptyForm(cardCategoryOptions[0], cardTierOptions[0])
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // ── Position in checklist (optional) ───────────────────────────────────
  const [positionQuery, setPositionQuery]     = useState("");
  const [positionResults, setPositionResults] = useState<CardOption[]>([]);
  const [positionOpen, setPositionOpen]       = useState(false);
  const [anchor, setAnchor]                   = useState<CardOption | null>(null);
  const [where, setWhere]                     = useState<"above" | "below">("below");
  const positionBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingCard ? toForm(editingCard) : emptyForm(cardCategoryOptions[0], cardTierOptions[0]));
    setError(null);
    setPositionQuery("");
    setPositionResults([]);
    setAnchor(null);
    setWhere("below");
  }, [isOpen, editingCard, cardCategoryOptions, cardTierOptions]);

  // Debounced search against this set's checklist, excluding the card
  // being edited (it can't be positioned relative to itself).
  useEffect(() => {
    if (!isOpen || !positionOpen) return;
    const trimmed = positionQuery.trim();
    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "8" });
        if (trimmed) params.set("q", trimmed);
        const res = await fetch(`/api/sets/${setId}/checklist/search?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        const options: CardOption[] = (data.options ?? []).filter(
          (o: CardOption) => o.id !== editingCard?.id
        );
        setPositionResults(options);
      } catch {
        setPositionResults([]);
      }
    }, trimmed ? 250 : 0);
    return () => clearTimeout(handle);
  }, [positionQuery, positionOpen, isOpen, setId, editingCard]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (positionBoxRef.current && !positionBoxRef.current.contains(e.target as Node)) {
        setPositionOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const setField =
    (key: keyof ChecklistCardFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const canSubmit = form.cardNumber.trim() !== "" && form.playerName.trim() !== "" && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const position = anchor ? { anchorCardId: anchor.id, where } : null;
    const result = await onSubmit(form, position);
    setSubmitting(false);
    if (result) {
      setError(result);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-5">
          {editingCard ? "Edit Checklist Card" : "Add Checklist Card"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Card Number</Label>
              <Input value={form.cardNumber} onChange={setField("cardNumber")} placeholder="e.g. CC-RN" />
            </div>
            <div>
              <Label>{playerColumnLabel}</Label>
              <Input value={form.playerName} onChange={setField("playerName")} placeholder="e.g. Rafael Nadal" />
            </div>
          </div>

          {showTeam && (
            <div>
              <Label>Team</Label>
              <Input value={form.team} onChange={setField("team")} placeholder="Optional" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Card Category</Label>
              <Select value={form.cardCategory} onChange={setField("cardCategory")}>
                {cardCategoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Card Tier</Label>
              <Select value={form.cardTier} onChange={setField("cardTier")}>
                {cardTierOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Parallel</Label>
              <Input value={form.parallel} onChange={setField("parallel")} placeholder="Optional — e.g. Gold" />
            </div>
            <div>
              <Label>Print Run</Label>
              <Input
                type="number"
                min={1}
                value={form.printRun}
                onChange={setField("printRun")}
                placeholder="Optional — e.g. 25"
              />
            </div>
          </div>

          <div>
            <Label>Variation Name</Label>
            <Input
              value={form.variationName}
              onChange={setField("variationName")}
              placeholder="Optional — e.g. Clay Court Masters"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isHit}
              onChange={setField("isHit")}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 accent-blue-500"
            />
            This is a hit (auto/relic/etc.)
          </label>

          {/* ── Position in checklist (optional) — search for another card by
              number or name, then place this one above or below it. Leaving
              this alone keeps the default behavior: new cards land at the
              end, edited cards stay where they are. ──────────────────── */}
          <div ref={positionBoxRef} className="relative">
            <Label>Position in Checklist</Label>
            {anchor ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <span className="flex-1 min-w-0 text-sm text-slate-200 truncate">
                  {where === "above" ? "Above" : "Below"}{" "}
                  <span className="font-semibold">{anchor.cardNumber} {anchor.playerName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setWhere("above")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    where === "above" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Above
                </button>
                <button
                  type="button"
                  onClick={() => setWhere("below")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    where === "below" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Below
                </button>
                <button
                  type="button"
                  onClick={() => setAnchor(null)}
                  aria-label="Clear position"
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <Input
                  value={positionQuery}
                  onChange={(e) => {
                    setPositionQuery(e.target.value);
                    setPositionOpen(true);
                  }}
                  onFocus={() => setPositionOpen(true)}
                  placeholder="Search by card number or name to set a position..."
                />
                {positionOpen && positionResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-slate-900 border border-slate-700/60 shadow-xl shadow-black/40 overflow-hidden max-h-44 overflow-y-auto">
                    {positionResults.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setAnchor(o);
                          setWhere("below");
                          setPositionQuery("");
                          setPositionOpen(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800/80 transition-colors border-b border-slate-800/60 last:border-0"
                      >
                        {o.cardNumber} {o.playerName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <p className="text-[11px] text-slate-500 mt-1">
              {editingCard
                ? "Leave blank to keep this card where it already is."
                : "Leave blank to add this card at the end of the checklist."}
            </p>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={setField("notes")}
              placeholder="Admin-only note shown in the public checklist's Notes column"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 pt-2">
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
              {submitting ? "Saving..." : editingCard ? "Save Changes" : "Add Card"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
