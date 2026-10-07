// components/admin/AdminEditGelModal.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Label, Input, Textarea, Select, ImageUploadField, MONTHS } from "@/components/set-detail/AddGelModal";
import type { AdminGelEntry } from "@/lib/data/adminGels";

interface FormState {
  acquisitionMethod: string;
  serialNumber: string;
  hitYear: string;
  hitMonth: string;
  hitCity: string;
  hitCountry: string;
  cardFrontImageUrl: string;
  cardBackImageUrl: string;
  seller: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  acquisitionMethod: "",
  serialNumber: "",
  hitYear: "",
  hitMonth: "",
  hitCity: "",
  hitCountry: "",
  cardFrontImageUrl: "",
  cardBackImageUrl: "",
  seller: "",
  notes: "",
};

export default function AdminEditGelModal({
  gel,
  onClose,
  onSuccess,
}: {
  gel: AdminGelEntry | null;
  onClose: () => void;
  onSuccess: (updated: { id: string; isInHand: boolean }) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [isInHand, setIsInHand] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gel) return;
    setIsInHand(gel.isInHand);
    setForm({
      acquisitionMethod: gel.acquisitionMethod ?? "",
      serialNumber: gel.serialNumber != null ? String(gel.serialNumber) : "",
      hitYear: gel.hitYear != null ? String(gel.hitYear) : "",
      hitMonth: gel.hitMonth != null ? String(gel.hitMonth) : "",
      hitCity: gel.hitCity ?? "",
      hitCountry: gel.hitCountry ?? "",
      cardFrontImageUrl: gel.cardFrontImageUrl ?? "",
      cardBackImageUrl: gel.cardBackImageUrl ?? "",
      seller: gel.seller ?? "",
      notes: gel.notes ?? "",
    });
    setError(null);
  }, [gel]);

  const isOther = !isInHand;

  function setField(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!gel) return;
    setError(null);

    if (!form.cardFrontImageUrl) {
      setError("A card front image is required.");
      return;
    }
    if (isOther && !form.notes.trim()) {
      setError("Please add a note describing where this card was seen.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/gels/${gel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedFor: isInHand ? "SELF" : "OTHER",
          acquisitionMethod: form.acquisitionMethod || null,
          serialNumber: form.serialNumber ? parseInt(form.serialNumber) : null,
          hitYear: form.hitYear ? parseInt(form.hitYear) : null,
          hitMonth: form.hitMonth ? parseInt(form.hitMonth) : null,
          hitCity: form.hitCity || null,
          hitCountry: form.hitCountry || null,
          cardFrontImageUrl: form.cardFrontImageUrl || null,
          cardBackImageUrl: form.cardBackImageUrl || null,
          seller: form.seller || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      onSuccess(data.gel);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {gel && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Edit gel"
          >
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 rounded-t-2xl" />
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Gel</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{gel.checklistCard.playerName}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
                  aria-label="Close modal"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* ── Own gel / someone else's toggle ──────────────────────── */}
              <div>
                <Label>Logged As</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsInHand(true); setForm((p) => ({ ...p, acquisitionMethod: "" })); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${isInHand ? "bg-blue-500/15 text-blue-300 border-blue-500/40" : "bg-slate-900/60 text-slate-400 border-slate-700/50"}`}
                  >
                    My Own Gel
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsInHand(false); setForm((p) => ({ ...p, acquisitionMethod: "" })); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${isOther ? "bg-orange-500/15 text-orange-300 border-orange-500/40" : "bg-slate-900/60 text-slate-400 border-slate-700/50"}`}
                  >
                    Someone Else&apos;s Gel
                  </button>
                </div>
              </div>

              <div>
                <Label>{isOther ? "Who pulled it?" : "How did you get it?"}</Label>
                <Select value={form.acquisitionMethod} onChange={setField("acquisitionMethod")}>
                  {isOther ? (
                    <>
                      <option value="" className="bg-slate-900">Select source...</option>
                      <option value="BREAKER" className="bg-slate-900">Breaker</option>
                      <option value="EBAY" className="bg-slate-900">eBay</option>
                      <option value="FRIEND" className="bg-slate-900">Friend</option>
                      <option value="SOCIAL_MEDIA" className="bg-slate-900">Social Media</option>
                      <option value="OTHER" className="bg-slate-900">Others</option>
                    </>
                  ) : (
                    <>
                      <option value="" className="bg-slate-900">Select method...</option>
                      <option value="PULLED" className="bg-slate-900">Pulled (from a pack)</option>
                      <option value="BOUGHT" className="bg-slate-900">Bought</option>
                    </>
                  )}
                </Select>
              </div>

              {!isOther && form.acquisitionMethod === "BOUGHT" && (
                <div>
                  <Label>Seller / Source</Label>
                  <Input value={form.seller} onChange={setField("seller")} placeholder="e.g. eBay, COMC, local shop..." />
                </div>
              )}

              <div>
                <Label>Serial Number</Label>
                <Input type="number" value={form.serialNumber} onChange={setField("serialNumber")} placeholder="e.g. 42" min="1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Month Pulled</Label>
                  <Select value={form.hitMonth} onChange={setField("hitMonth")}>
                    <option value="" className="bg-slate-900">Month...</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1} className="bg-slate-900">{m}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Year Pulled</Label>
                  <Input type="number" value={form.hitYear} onChange={setField("hitYear")} placeholder="e.g. 2024" min="1980" max={new Date().getFullYear()} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input value={form.hitCity} onChange={setField("hitCity")} placeholder="e.g. Chicago" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={form.hitCountry} onChange={setField("hitCountry")} placeholder="e.g. USA" />
                </div>
              </div>

              <ImageUploadField label="Card Front Image *" value={form.cardFrontImageUrl} onChange={(v) => setForm((p) => ({ ...p, cardFrontImageUrl: v }))} />
              <ImageUploadField label="Card Back Image" value={form.cardBackImageUrl} onChange={(v) => setForm((p) => ({ ...p, cardBackImageUrl: v }))} />

              <div>
                <Label>{isOther ? "Notes (e.g. breaker name, eBay seller name etc.) *" : "Notes"}</Label>
                <Textarea value={form.notes} onChange={setField("notes")} placeholder={isOther ? "e.g. Hobby Shop Breaks, @username on Instagram..." : "Any extra details about this card..."} />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 overflow-hidden"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700/60 text-slate-300 text-sm font-semibold hover:bg-slate-800/60 transition-colors duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !form.cardFrontImageUrl || (isOther && !form.notes.trim())}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors duration-150 shadow-lg shadow-blue-900/30"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
