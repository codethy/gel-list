// components/set-detail/AddGelModal.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GelEntry } from "./YourGels";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface CardTemplateOption {
  id: string;
  playerName: string;
  cardType: string;
  parallelType?: string | null;
  printRun?: number | null;
  team?: string | null;
}

interface AddGelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newGel: GelEntry) => void;
  setId: string;
  templates: CardTemplateOption[];
  preselectedTemplateId?: string | null;
  preselectedPlayerName?: string | null;
}

// ─── FORM STATE ───────────────────────────────────────────────────────────────

interface FormState {
  cardTemplateId: string;
  acquisitionMethod: string;
  serialNumber: string;
  hitYear: string;
  hitMonth: string;
  hitCity: string;
  hitCountry: string;
  // These now hold base64 data URLs from the uploaded files, not typed URLs
  cardFrontImageUrl: string;
  cardBackImageUrl: string;
  seller: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  cardTemplateId:    "",
  acquisitionMethod: "",
  serialNumber:      "",
  hitYear:           "",
  hitMonth:          "",
  hitCity:           "",
  hitCountry:        "",
  cardFrontImageUrl: "",
  cardBackImageUrl:  "",
  seller:            "",
  notes:             "",
};

const MONTHS = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Reads a File and resolves with a base64 data URL string.
// This is used for the card image upload — no server upload endpoint needed.
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── FORM FIELD COMPONENTS ────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
      {...rest}
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      value={value as string}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150 resize-none"
    />
  );
}

function Select({
  value,
  onChange,
  children,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150 cursor-pointer"
    >
      {children}
    </select>
  );
}

// ─── IMAGE UPLOAD FIELD ───────────────────────────────────────────────────────
//
// Replaces the old URL text input. Shows:
//   • An "Upload Image" button that opens the OS file picker
//   • A small preview of the chosen image once picked
//   • A "Remove" link to clear the selection

function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;         // base64 data URL, or "" if nothing selected
  onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file (JPG, PNG, WEBP, etc.)");
      return;
    }

    // 5 MB size guard — base64 images larger than this will make the JSON body huge
    if (file.size > 5 * 1024 * 1024) {
      alert("Please choose an image smaller than 5 MB.");
      return;
    }

    setIsLoading(true);
    try {
      const dataUrl = await readFileAsDataURL(file);
      onChange(dataUrl);
    } catch {
      alert("Could not read the file. Please try again.");
    } finally {
      setIsLoading(false);
      // Reset input so the same file can be re-selected if the user removes and re-uploads
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Label>{label}</Label>

      {/* Hidden native file input — triggered by the button below */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
        aria-label={`Upload ${label}`}
      />

      {value ? (
        // ── Preview state ──────────────────────────────────────────────────
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50">
          <img
            src={value}
            alt="Card preview"
            className="w-12 h-16 object-cover rounded-md border border-slate-700/50 shadow-sm shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-300 font-medium">Image selected</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Click below to change or remove</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold transition-colors"
              >
                Change
              </button>
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-[11px] text-red-400 hover:text-red-300 font-semibold transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        // ── Upload button state ────────────────────────────────────────────
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
          className="
            w-full flex items-center justify-center gap-2
            px-3 py-3 rounded-xl
            bg-slate-900/60 border border-dashed border-slate-600/60
            text-slate-400 hover:text-slate-200 hover:border-slate-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150 group
          "
        >
          {isLoading ? (
            <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform duration-150">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          <span className="text-sm font-medium">
            {isLoading ? "Reading file..." : "Upload Image"}
          </span>
          <span className="text-xs text-slate-600">JPG, PNG, WEBP — max 5 MB</span>
        </button>
      )}
    </div>
  );
}

// ─── TEMPLATE SEARCH ──────────────────────────────────────────────────────────

function TemplateSearch({
  templates,
  selectedId,
  onSelect,
  isLocked,
}: {
  templates: CardTemplateOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLocked: boolean;
}) {
  const [query, setQuery]   = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  const selected = templates.find((t) => t.id === selectedId);

  const filtered = query.trim()
    ? templates.filter((t) =>
        t.playerName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20)
    : templates.slice(0, 20);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLocked && selected) {
    return (
      <div className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200">
        <span className="font-semibold">{selected.playerName}</span>
        {selected.parallelType && (
          <span className="text-slate-400 ml-2">— {selected.parallelType}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={selected ? selected.playerName : query}
        onChange={(e) => {
          setQuery(e.target.value);
          onSelect("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Search for a player..."
        className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150"
      />
      <AnimatePresence>
        {isOpen && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-slate-900 border border-slate-700/60 shadow-xl shadow-black/40 overflow-hidden max-h-52 overflow-y-auto"
          >
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSelect(t.id);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-800/80 transition-colors duration-100 border-b border-slate-800/60 last:border-0"
              >
                <p className="text-sm text-slate-200 font-medium">{t.playerName}</p>
                <p className="text-xs text-slate-500">
                  {t.cardType.replace(/_/g, " ")}
                  {t.parallelType ? ` — ${t.parallelType}` : ""}
                  {t.printRun ? ` (/${t.printRun})` : ""}
                </p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AddGelModal({
  isOpen,
  onClose,
  onSuccess,
  setId,
  templates,
  preselectedTemplateId,
}: AddGelModalProps) {
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const modalRef                  = useRef<HTMLDivElement>(null);

  // ── Pre-fill when triggered from checklist row ────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY_FORM, cardTemplateId: preselectedTemplateId ?? "" });
      setError(null);
    }
  }, [isOpen, preselectedTemplateId]);

  // ── Escape key close ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // ── Generic field updater for text/select inputs ──────────────────────────
  const setField = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
      },
    []
  );

  // ── Image field updater (receives data URL string directly) ───────────────
  const setImageField = useCallback(
    (field: "cardFrontImageUrl" | "cardBackImageUrl") =>
      (dataUrl: string) => {
        setForm((prev) => ({ ...prev, [field]: dataUrl }));
      },
    []
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.cardTemplateId) {
      setError("Please select a card from the list.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/sets/${setId}/gels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardTemplateId:    form.cardTemplateId,
          acquisitionMethod: form.acquisitionMethod || null,
          serialNumber:      form.serialNumber ? parseInt(form.serialNumber) : null,
          hitYear:           form.hitYear   ? parseInt(form.hitYear)   : null,
          hitMonth:          form.hitMonth  ? parseInt(form.hitMonth)  : null,
          hitCity:           form.hitCity   || null,
          hitCountry:        form.hitCountry || null,
          // These will be base64 data URLs or null if no file was chosen
          cardFrontImageUrl: form.cardFrontImageUrl || null,
          cardBackImageUrl:  form.cardBackImageUrl  || null,
          seller:            form.seller || null,
          notes:             form.notes  || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      onSuccess(data.gel as GelEntry);
      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop ─────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* ── Modal Panel ──────────────────────────────────────────────── */}
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="Log a new gel"
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 rounded-t-2xl" />

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* ── Header ───────────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Log a Gel</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Record a card you pulled or purchased from this set.
                  </p>
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

              {/* ── Card Selection ───────────────────────────────────────── */}
              <div>
                <Label>Card *</Label>
                <TemplateSearch
                  templates={templates}
                  selectedId={form.cardTemplateId}
                  onSelect={(id) => setForm((prev) => ({ ...prev, cardTemplateId: id }))}
                  isLocked={Boolean(preselectedTemplateId)}
                />
              </div>

              {/* ── Acquisition Method ───────────────────────────────────── */}
              <div>
                <Label>How did you get it?</Label>
                <Select value={form.acquisitionMethod} onChange={setField("acquisitionMethod")}>
                  <option value="" className="bg-slate-900">Select method...</option>
                  <option value="PULLED" className="bg-slate-900">Pulled (from a pack)</option>
                  <option value="BOUGHT" className="bg-slate-900">Bought</option>
                </Select>
              </div>

              {/* ── Seller (conditional on BOUGHT) ───────────────────────── */}
              <AnimatePresence>
                {form.acquisitionMethod === "BOUGHT" && (
                  <motion.div
                    key="seller"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <Label>Seller / Source</Label>
                    <Input
                      value={form.seller}
                      onChange={setField("seller")}
                      placeholder="e.g. eBay, COMC, local shop..."
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Serial Number ────────────────────────────────────────── */}
              <div>
                <Label>Serial Number</Label>
                <Input
                  type="number"
                  value={form.serialNumber}
                  onChange={setField("serialNumber")}
                  placeholder="e.g. 42"
                  min="1"
                />
              </div>

              {/* ── Hit Date ─────────────────────────────────────────────── */}
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
                  <Input
                    type="number"
                    value={form.hitYear}
                    onChange={setField("hitYear")}
                    placeholder="e.g. 2024"
                    min="1980"
                    max={new Date().getFullYear()}
                  />
                </div>
              </div>

              {/* ── Hit Location ─────────────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input
                    value={form.hitCity}
                    onChange={setField("hitCity")}
                    placeholder="e.g. Chicago"
                  />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input
                    value={form.hitCountry}
                    onChange={setField("hitCountry")}
                    placeholder="e.g. USA"
                  />
                </div>
              </div>

              {/* ── Card Images — Upload buttons (replaces URL text inputs) ── */}
              <ImageUploadField
                label="Card Front Image"
                value={form.cardFrontImageUrl}
                onChange={setImageField("cardFrontImageUrl")}
              />
              <ImageUploadField
                label="Card Back Image"
                value={form.cardBackImageUrl}
                onChange={setImageField("cardBackImageUrl")}
              />

              {/* ── Notes ────────────────────────────────────────────────── */}
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={setField("notes")}
                  placeholder="Any extra details about this card..."
                />
              </div>

              {/* ── Error ────────────────────────────────────────────────── */}
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

              {/* ── Submit buttons ───────────────────────────────────────── */}
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
                  disabled={isSubmitting || !form.cardTemplateId}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors duration-150 shadow-lg shadow-blue-900/30"
                >
                  {isSubmitting ? "Saving..." : "Log Gel"}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
