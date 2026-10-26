// components/admin/AdminEditSetModal.tsx
//
// Edits a CardSet's own name/year/brand/category/subcategory/description —
// separate from AdminChecklistCardModal, which edits individual
// ChecklistCard rows. Used by app/admin/sets/[id]/checklist/page.tsx.

"use client";

import { useEffect, useState } from "react";
import { Label, Input, Select, Textarea } from "@/components/set-detail/AddGelModal";
import { TAXONOMY } from "@/lib/taxonomy";

export interface AdminSetDetails {
  id:          string;
  name:        string;
  year:        number;
  brand:       string;
  category:    string;
  subCategory: string;
  description: string | null;
}

interface AdminEditSetModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSubmit: (values: {
    name: string; year: number; brand: string; category: string; subCategory: string; description: string;
  }) => Promise<string | void>;
  set: AdminSetDetails;
}

export default function AdminEditSetModal({ isOpen, onClose, onSubmit, set }: AdminEditSetModalProps) {
  const [name, setName]               = useState(set.name);
  const [year, setYear]               = useState(String(set.year));
  const [brand, setBrand]             = useState(set.brand);
  const [category, setCategory]       = useState(set.category);
  const [subCategory, setSubCategory] = useState(set.subCategory.toUpperCase());
  const [description, setDescription] = useState(set.description ?? "");
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(set.name);
    setYear(String(set.year));
    setBrand(set.brand);
    setCategory(set.category);
    setSubCategory(set.subCategory.toUpperCase());
    setDescription(set.description ?? "");
    setError(null);
  }, [isOpen, set]);

  if (!isOpen) return null;

  const activeParent = TAXONOMY.find((t) => t.enumValue === category) ?? TAXONOMY[0];

  function handleCategoryChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextCategory = e.target.value;
    setCategory(nextCategory);
    // Switching category — the old subcategory almost certainly doesn't
    // belong to the new one, so default to the new category's first child.
    const nextParent = TAXONOMY.find((t) => t.enumValue === nextCategory);
    setSubCategory(nextParent?.children[0]?.id ?? "");
  }

  const canSubmit = name.trim() !== "" && brand.trim() !== "" && year.trim() !== "" && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit({
      name: name.trim(),
      year: Number(year),
      brand: brand.trim(),
      category,
      subCategory,
      description: description.trim(),
    });
    setSubmitting(false);
    if (result) setError(result);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900 p-6">
        <h2 className="text-lg font-bold text-white mb-5">Edit Set Details</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Set Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Year</Label>
              <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onChange={handleCategoryChange}>
                {TAXONOMY.map((t) => (
                  <option key={t.enumValue} value={t.enumValue}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Subcategory</Label>
              <Select value={subCategory} onChange={(e) => setSubCategory(e.target.value)}>
                {activeParent.children.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
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
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
