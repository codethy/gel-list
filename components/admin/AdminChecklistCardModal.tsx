// components/admin/AdminChecklistCardModal.tsx
//
// Add/edit form for a single ChecklistCard row, used by
// components/admin/AdminChecklistClient.tsx. Reuses the same form
// primitives as the user-facing Add Gel modal for visual consistency.

"use client";

import { useEffect, useState } from "react";
import { Label, Input, Select } from "@/components/set-detail/AddGelModal";
import type { AdminChecklistCard } from "@/lib/data/adminChecklist";

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
  };
}

interface AdminChecklistCardModalProps {
  isOpen:              boolean;
  onClose:             () => void;
  onSubmit:            (values: ChecklistCardFormValues) => Promise<string | void>; // returns an error message, or nothing on success
  editingCard:         AdminChecklistCard | null;
  playerColumnLabel:   string; // "Player" (Sports) or "Character" (Entertainment/TCG)
  showTeam:            boolean;
  cardCategoryOptions: string[];
  cardTierOptions:     string[];
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
}: AdminChecklistCardModalProps) {
  const [form, setForm]           = useState<ChecklistCardFormValues>(() =>
    editingCard ? toForm(editingCard) : emptyForm(cardCategoryOptions[0], cardTierOptions[0])
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm(editingCard ? toForm(editingCard) : emptyForm(cardCategoryOptions[0], cardTierOptions[0]));
    setError(null);
  }, [isOpen, editingCard, cardCategoryOptions, cardTierOptions]);

  if (!isOpen) return null;

  const setField =
    (key: keyof ChecklistCardFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
    };

  const canSubmit = form.cardNumber.trim() !== "" && form.playerName.trim() !== "" && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(form);
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
