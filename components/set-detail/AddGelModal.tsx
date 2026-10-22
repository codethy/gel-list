// components/set-detail/AddGelModal.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GelEntry } from "./YourGels";
import { playerSubtitle } from "./ChecklistTable";
import { useUploadThing } from "@/lib/uploadthing";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ChecklistCardOption {
  id: string;
  playerName: string;
  cardType: string;
  parallelType?: string | null;
  printRun?: number | null;
  variationName?: string | null;
  team?: string | null;
}

// One entry in this set's admin-curated product catalog (see SetProduct in
// prisma/schema.prisma) — options for the "Which Product" dropdown, enabled
// only when "How did you get it?" is "Pulled".
export interface ProductOption {
  id:               string;
  productType:      string;
  productTypeOther: string | null;
  label:            string;
}

interface AddGelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (gel: GelEntry) => void;
  setId: string;
  templates: ChecklistCardOption[];
  products: ProductOption[];
  preselectedChecklistCardId?: string | null;
  preselectedPlayerName?: string | null;
  // When set, the modal edits this existing gel instead of creating a new
  // one: the form prefills from it, the card selection is locked (you can't
  // reassign a logged gel to a different card), and submitting PATCHes
  // instead of POSTing.
  editingGel?: GelEntry | null;
}

// ─── LOGGED FOR ───────────────────────────────────────────────────────────────
// "SELF": the logging user actually has this card — the original "Log a
// Gel" flow, backed by PortfolioCard.isInHand: true.
// "OTHER": the user is just reporting a card they saw someone else pull or
// sell online — PortfolioCard.isInHand: false. Drives the checklist row's
// "Surfaced" status (amber) instead of "Owned" (green), and keeps the entry
// out of the reporting user's own "Your Gels" list.
type LoggedFor = "SELF" | "OTHER";

// ─── FORM STATE ───────────────────────────────────────────────────────────────

interface FormState {
  checklistCardId: string;
  acquisitionMethod: string;
  // The selected ProductOption's id (not the raw ProductType) — a set can
  // have more than one "Other" entry with different custom labels, so the
  // option's own id is what disambiguates which one was picked. Resolved
  // back to productType/productTypeOther at submit time.
  productOptionId: string;
  serialNumber: string;
  hitYear: string;
  hitMonth: string;
  hitCity: string;
  hitCountry: string;
  // These hold UploadThing URLs once uploaded, not the raw file
  cardFrontImageUrl: string;
  cardBackImageUrl: string;
  seller: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  checklistCardId:   "",
  acquisitionMethod: "",
  productOptionId:   "",
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

export const MONTHS = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December",
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// iPhones save photos as HEIC by default. It's a valid "image/*" file (so it
// passes the file-type check and iOS lets you pick it), but browsers other
// than Safari can't decode HEIC in an <img> tag — it just renders broken.
// file.type is usually "image/heic"/"image/heif", but some browsers leave it
// blank for HEIC files, so the extension is checked too as a fallback.
function isHeicFile(file: File): boolean {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}

// Converts a HEIC file to a JPEG Blob so it can actually be displayed.
// heic2any returns an array only for multi-image HEIC containers (e.g. Live
// Photos) — a card photo is always a single image, so the first result is
// the one we want.
async function convertHeicToJpeg(file: File): Promise<Blob> {
  // Loaded dynamically, not as a top-level import — heic2any references
  // `window` at module-load time, which crashes server-side rendering of
  // this whole component if it's imported statically. A dynamic import only
  // ever runs here, inside a browser-only event handler, never during SSR.
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
  return Array.isArray(result) ? result[0] : result;
}

// ─── FORM FIELD COMPONENTS ────────────────────────────────────────────────────

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

export function Input({
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

export function Textarea({
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

export function Select({
  value,
  onChange,
  disabled,
  children,
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full px-3 py-2.5 rounded-xl bg-slate-900/60 border border-slate-700/50 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 transition-all duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

export function ImageUploadField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;         // the uploaded image's URL, or "" if nothing selected
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isConverting, setIsConverting] = useState(false);
  const { startUpload, isUploading } = useUploadThing("cardImage", {
    onUploadError: () => {
      alert("Could not upload this image. Please try again.");
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow image files — HEIC sometimes reports a blank file.type, so
    // the extension is also accepted here (isHeicFile checks both).
    if (!file.type.startsWith("image/") && !isHeicFile(file)) {
      alert("Please select an image file (JPG, PNG, WEBP, etc.)");
      return;
    }

    try {
      let fileToUpload: File = file;

      if (isHeicFile(file)) {
        setIsConverting(true);
        try {
          const jpegBlob = await convertHeicToJpeg(file);
          fileToUpload = new File(
            [jpegBlob],
            file.name.replace(/\.(heic|heif)$/i, ".jpg"),
            { type: "image/jpeg" }
          );
        } catch {
          alert("Could not convert this HEIC photo. Please try a different image.");
          return;
        } finally {
          setIsConverting(false);
        }
      }

      // 16 MB guard, matching the UploadThing route's own maxFileSize —
      // checked against what's actually about to be uploaded, since a
      // converted JPEG can end up a different size than the original file.
      if (fileToUpload.size > 16 * 1024 * 1024) {
        alert("Please choose an image smaller than 16 MB.");
        return;
      }

      // Uploads straight to UploadThing's storage — the actual image bytes
      // never pass through our own API, only the resulting URL does.
      const result = await startUpload([fileToUpload]);
      if (!result?.[0]) {
        alert("Could not upload this image. Please try again.");
        return;
      }
      onChange(result[0].ufsUrl);
    } catch {
      alert("Could not upload this image. Please try again.");
    } finally {
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
          disabled={isUploading}
          className="
            w-full flex items-center justify-center gap-2
            px-3 py-3 rounded-xl
            bg-slate-900/60 border border-dashed border-slate-600/60
            text-slate-400 hover:text-slate-200 hover:border-slate-500
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-150 group
          "
        >
          {isUploading ? (
            <div className="w-4 h-4 rounded-full border-2 border-slate-500 border-t-transparent animate-spin" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform duration-150">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
          <span className="text-sm font-medium">
            {isConverting ? "Converting photo..." : isUploading ? "Uploading..." : "Upload Image"}
          </span>
          <span className="text-xs text-slate-600">JPG, PNG, WEBP — max 16 MB</span>
        </button>
      )}
    </div>
  );
}

// Strips diacritics so a plain "Joao" matches "João" — mirrors the
// unaccent() SQL used by the checklist table's own search (see
// app/api/sets/[id]/checklist/route.ts) so both search boxes behave the
// same way.
function foldDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Matches player name, parallel, variation name, and team — plus print run
// when the query is a bare number or "/99"-style, mirroring the checklist
// table's own search (app/api/sets/[id]/checklist/route.ts) so both search
// boxes behave the same way.
// Splits the query on whitespace into keywords — every keyword must match
// *somewhere* (different keywords can each match a different field), so
// "Coco Gauff Tour" finds every parallel of her "Tour Relic Autographs"
// insert, and "Coco Gauff /50" finds just her /50 copies.
function matchesKeyword(t: ChecklistCardOption, keyword: string): boolean {
  const q = foldDiacritics(keyword.toLowerCase());

  if (foldDiacritics(t.playerName.toLowerCase()).includes(q)) return true;
  if (t.parallelType && foldDiacritics(t.parallelType.toLowerCase()).includes(q)) return true;
  if (t.variationName && foldDiacritics(t.variationName.toLowerCase()).includes(q)) return true;
  if (t.team && foldDiacritics(t.team.toLowerCase()).includes(q)) return true;

  const qNumeric = q.replace(/^\//, "");
  if (t.printRun != null && /^\d+$/.test(qNumeric) && String(t.printRun) === qNumeric) return true;

  return false;
}

function matchesSearchQuery(t: ChecklistCardOption, rawQuery: string): boolean {
  const keywords = rawQuery.trim().split(/\s+/).filter(Boolean);
  return keywords.every((keyword) => matchesKeyword(t, keyword));
}

// ─── CHECKLIST CARD SEARCH ────────────────────────────────────────────────────

function ChecklistCardSearch({
  templates,
  selectedId,
  onSelect,
  isLocked,
}: {
  templates: ChecklistCardOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  isLocked: boolean;
}) {
  const [query, setQuery]   = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  const selected = templates.find((t) => t.id === selectedId);

  const filtered = query.trim()
    ? templates.filter((t) => matchesSearchQuery(t, query)).slice(0, 20)
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
        {playerSubtitle(selected) && (
          <span className="text-slate-400 ml-2">— {playerSubtitle(selected)}</span>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={
          selected
            ? [selected.playerName, playerSubtitle(selected)].filter(Boolean).join(" ")
            : query
        }
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
                {playerSubtitle(t) && (
                  <p className="text-xs text-slate-500">{playerSubtitle(t)}</p>
                )}
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
  products,
  preselectedChecklistCardId,
  editingGel,
}: AddGelModalProps) {
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const modalRef                  = useRef<HTMLDivElement>(null);

  // "choice": the "are you logging your own gel or someone else's?" screen —
  // shown first for every fresh (non-edit) open. "form": the actual log
  // form, in either its SELF or OTHER variant depending on loggedFor.
  const [step, setStep]           = useState<"choice" | "form">("choice");
  const [loggedFor, setLoggedFor] = useState<LoggedFor>("SELF");

  const isEditing = Boolean(editingGel);
  const isOther   = loggedFor === "OTHER";

  // ── Pre-fill when opened — from an existing gel (edit) or a checklist
  // row (create, with the card pre-picked) ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (editingGel) {
      // Editing always resumes directly into the form the gel was
      // originally logged under — there's no reassigning SELF ↔ OTHER.
      setStep("form");
      setLoggedFor(editingGel.isInHand === false ? "OTHER" : "SELF");
      // Resolve which ProductOption (if any) matches this gel's stored
      // productType/productTypeOther — note this can come up empty if the
      // admin has since removed that product from the set's catalog, in
      // which case "Which Product" just reopens unselected.
      const matchingProduct = products.find(
        (p) =>
          p.productType === (editingGel.productType ?? null) &&
          p.productTypeOther === (editingGel.productTypeOther ?? null)
      );
      setForm({
        checklistCardId:   editingGel.cardTemplateId,
        acquisitionMethod: editingGel.acquisitionMethod ?? "",
        productOptionId:   editingGel.productType ? (matchingProduct?.id ?? "") : "",
        serialNumber:      editingGel.serialNumber      != null ? String(editingGel.serialNumber) : "",
        hitYear:           editingGel.hitYear            != null ? String(editingGel.hitYear)      : "",
        hitMonth:          editingGel.hitMonth            != null ? String(editingGel.hitMonth)     : "",
        hitCity:           editingGel.hitCity            ?? "",
        hitCountry:        editingGel.hitCountry         ?? "",
        cardFrontImageUrl: editingGel.cardFrontImageUrl  ?? "",
        cardBackImageUrl:  editingGel.cardBackImageUrl   ?? "",
        seller:            editingGel.seller             ?? "",
        notes:             editingGel.notes               ?? "",
      });
    } else {
      setStep("choice");
      setLoggedFor("SELF");
      setForm({ ...EMPTY_FORM, checklistCardId: preselectedChecklistCardId ?? "" });
    }
    setError(null);
  }, [isOpen, editingGel, preselectedChecklistCardId, products]);

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

    if (!form.checklistCardId) {
      setError("Please select a card from the list.");
      return;
    }

    if (!form.cardFrontImageUrl) {
      setError("Please upload a card front image.");
      return;
    }

    if (isOther && !form.notes.trim()) {
      setError("Please add a note describing where you saw this card pulled.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/sets/${setId}/gels/${editingGel!.id}`
        : `/api/sets/${setId}/gels`;

      // "Which Product" only ever applies to the "my own gel, pulled it"
      // case — resolve the chosen ProductOption's id back to the raw
      // productType/productTypeOther pair the server stores.
      const selectedProduct =
        !isOther && form.acquisitionMethod === "PULLED"
          ? products.find((p) => p.id === form.productOptionId)
          : undefined;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Wire field name stays "cardTemplateId" to match what
          // app/api/sets/[id]/gels/route.ts expects — that field name is a
          // leftover from the removed CardTemplate model, kept there
          // intentionally rather than renamed everywhere. Ignored by the
          // PATCH route — editing a gel never reassigns its card.
          cardTemplateId:    form.checklistCardId,
          loggedFor:         loggedFor,
          acquisitionMethod: form.acquisitionMethod || null,
          productType:       selectedProduct?.productType ?? null,
          productTypeOther:  selectedProduct?.productTypeOther ?? null,
          serialNumber:      form.serialNumber ? parseInt(form.serialNumber) : null,
          hitYear:           form.hitYear   ? parseInt(form.hitYear)   : null,
          hitMonth:          form.hitMonth  ? parseInt(form.hitMonth)  : null,
          hitCity:           form.hitCity   || null,
          hitCountry:        form.hitCountry || null,
          // These hold UploadThing URLs, or null if no image was chosen
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
            aria-label={isEditing ? "Edit gel" : "Log a new gel"}
          >
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-600 rounded-t-2xl" />

            {step === "choice" ? (
              <div className="p-6 space-y-5">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">Log a Gel</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Is this a card you have, or one you saw someone else pull?
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

                {/* ── Choice buttons ───────────────────────────────────────── */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLoggedFor("SELF");
                      setForm((prev) => ({ ...prev, acquisitionMethod: "", seller: "" }));
                      setStep("form");
                    }}
                    className="w-full flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/60 hover:bg-slate-800 text-left transition-all duration-150"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">My Own Gel</p>
                      <p className="text-xs text-slate-400 mt-0.5">You pulled or bought this card yourself.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLoggedFor("OTHER");
                      setForm((prev) => ({ ...prev, acquisitionMethod: "", seller: "" }));
                      setStep("form");
                    }}
                    className="w-full flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-orange-500/60 hover:bg-slate-800 text-left transition-all duration-150"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4.3-4.3" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Someone Else&apos;s Gel</p>
                      <p className="text-xs text-slate-400 mt-0.5">You saw this card pulled or sold online.</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* ── Header ───────────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => setStep("choice")}
                      className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 font-medium mb-1 transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                      </svg>
                      Back
                    </button>
                  )}
                  <h2 className="text-lg font-bold text-white">{isEditing ? "Edit Gel" : "Log a Gel"}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isEditing
                      ? "Update the details for this logged gel."
                      : isOther
                        ? "Record a card you saw someone else pull or sell."
                        : "Record a card you pulled or purchased from this set."}
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
                <ChecklistCardSearch
                  templates={templates}
                  selectedId={form.checklistCardId}
                  onSelect={(id) => setForm((prev) => ({ ...prev, checklistCardId: id }))}
                  isLocked={Boolean(preselectedChecklistCardId) || isEditing}
                />
              </div>

              {/* ── Acquisition Method ───────────────────────────────────── */}
              <div>
                <Label>{isOther ? "Who pulled it?" : "How did you get it?"}</Label>
                <Select
                  value={form.acquisitionMethod}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      acquisitionMethod: value,
                      // "Which Product" only applies to "Pulled" — clear
                      // any selection made while it was briefly enabled.
                      productOptionId: value === "PULLED" ? prev.productOptionId : "",
                    }));
                  }}
                >
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
                      <option value="BREAKER" className="bg-slate-900">From a Break</option>
                    </>
                  )}
                </Select>
              </div>

              {/* ── Which Product (SELF flow only, enabled only once
                  "Pulled" is selected above) ───────────────────────────── */}
              {!isOther && (
                <div>
                  <Label>Which Product</Label>
                  <Select
                    value={form.productOptionId}
                    onChange={setField("productOptionId")}
                    disabled={form.acquisitionMethod !== "PULLED"}
                  >
                    {form.acquisitionMethod !== "PULLED" ? (
                      <option value="" className="bg-slate-900">Select &quot;Pulled&quot; above first</option>
                    ) : products.length === 0 ? (
                      <option value="" className="bg-slate-900">No products added for this set yet</option>
                    ) : (
                      <>
                        <option value="" className="bg-slate-900">Select product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id} className="bg-slate-900">{p.label}</option>
                        ))}
                      </>
                    )}
                  </Select>
                </div>
              )}

              {/* ── Seller (conditional on BOUGHT, "my own gel" flow only —
                  the "someone else's gel" flow captures this in Notes instead) ── */}
              <AnimatePresence>
                {!isOther && form.acquisitionMethod === "BOUGHT" && (
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
                label="Card Front Image *"
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
                <Label>{isOther ? "Notes (e.g. breaker name, eBay seller name etc.) *" : "Notes"}</Label>
                <Textarea
                  value={form.notes}
                  onChange={setField("notes")}
                  placeholder={isOther ? "e.g. Hobby Shop Breaks, @username on Instagram..." : "Any extra details about this card..."}
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
                  disabled={
                    isSubmitting ||
                    !form.checklistCardId ||
                    !form.cardFrontImageUrl ||
                    (isOther && !form.notes.trim())
                  }
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors duration-150 shadow-lg shadow-blue-900/30"
                >
                  {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Log Gel"}
                </button>
              </div>
            </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
