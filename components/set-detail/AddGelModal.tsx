// components/set-detail/AddGelModal.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import type { GelEntry } from "./YourGels";
import { playerSubtitle } from "./ChecklistTable";
import { useUploadThing } from "@/lib/uploadthing";
import { COUNTRIES } from "@/lib/countries";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ChecklistCardOption {
  id: string;
  cardNumber: string;
  playerName: string;
  cardType: string;
  // Drives the mandatory-Serial-Number rule below — a "NUMBERED" card
  // can't be logged without one.
  cardTier?: string;
  parallelType?: string | null;
  printRun?: number | null;
  variationName?: string | null;
  team?: string | null;
}

// What a "Claim this card" button (Recent Pulls popup, Logged Gels/Card
// History popup) hands to AddGelModal to open straight into the SELF/
// Single form, locked to this specific card+serial — see the
// `claimPrefill` prop below.
export interface ClaimPrefill {
  cardOption: ChecklistCardOption;
  serialNumber: number;
}

// What "Did you buy this?" / "Did you pull this?" (CardImageModal's "..."
// menu) hands to AddGelModal — same straight-to-form treatment as
// ClaimPrefill above, except both the card+serial AND the acquisition
// method are locked (the button itself determines which), and submitting
// posts to the dedicated co-claim endpoint (see
// app/api/sets/[id]/gels/co-claim/route.ts) instead of the normal create
// route — there's no 409/confirm round-trip here, since filling out this
// whole form already is the confirmation.
export interface CoOwnPrefill {
  cardOption: ChecklistCardOption;
  serialNumber: number | null;
  acquisitionMethod: "PULLED" | "BOUGHT";
  targetGelId: string;
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
  // "SPORTS" | "ENTERTAINMENT" | "TCG" — gates TCG-only differences: the
  // "Search for a card" placeholder (vs. "Search for a player") and hiding
  // the Serial Number field (TCG cards aren't reliably serial-numbered).
  category: string;
  // This set's release year — the floor of the "Year Pulled" dropdown's
  // range (through the current year).
  setYear: number;
  products: ProductOption[];
  // The full option — not just an id — since the modal no longer holds
  // every checklist card in memory to look one up by id (see
  // ChecklistCardSearch). Set when opened from a specific checklist row's
  // "+" button.
  preselectedCardOption?: ChecklistCardOption | null;
  // When set, the modal edits this existing gel instead of creating a new
  // one: the form prefills from it, the card selection is locked (you can't
  // reassign a logged gel to a different card), and submitting PATCHes
  // instead of POSTing.
  editingGel?: GelEntry | null;
  // Overrides the PATCH url used when editingGel is set — defaults to the
  // user-facing /api/sets/[id]/gels/[gelId]. components/admin/
  // AdminEditGelModal.tsx passes /api/admin/gels/[gelId] here instead, so
  // the Gel Review Queue's "Edit" action reuses this exact same form (and
  // automatically stays in sync with any future changes to it) while still
  // going through the admin route's no-ownership-check/no-reverify
  // semantics.
  editSubmitUrl?: string;
  // When set (and no editingGel), the modal opens straight into the
  // Single Gel / "My Own Gel" form — skipping the choice/mode screens —
  // prefilled and locked to this specific card+serial. Set from the
  // "Claim this card" buttons (Recent Pulls popup, Logged Gels/Card
  // History popup) for a card someone else only reported seeing; the
  // actual claim is detected and confirmed server-side on submit, the
  // same 409 duplicateKind: "CLAIM" flow a regular SELF-vs-OTHER
  // collision during normal logging goes through.
  claimPrefill?: ClaimPrefill | null;
  // When set (and no editingGel/claimPrefill), same straight-to-form
  // treatment, except both card+serial AND acquisition method are locked
  // and submitting goes to the co-claim endpoint — see CoOwnPrefill above.
  coOwnPrefill?: CoOwnPrefill | null;
  // This user's own most recently submitted City/Country (SELF flow only)
  // — see lib/data/userGelDefaults.ts. Pre-fills a fresh "My Own Gel" log,
  // never "Someone Else's Gel".
  defaultHitCity?:    string | null;
  defaultHitCountry?: string | null;
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
  // Only meaningful when acquisitionMethod is "BREAKER" — shared across
  // every card in the Multiple Gels flow, same as acquisitionMethod itself.
  breakerName: string;
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
  breakerName:       "",
  notes:             "",
};

export const MONTHS = [
  "January","February","March","April",
  "May","June","July","August",
  "September","October","November","December",
];

// ─── MULTI-CARD ENTRY (Multiple Gels flow) ────────────────────────────────────
// One repeatable Card/Serial/Images/Notes block — everything else (how it
// was acquired, which product, when, where) is shared across every entry,
// still held in the single `form` FormState above.
interface MultiCardEntry {
  key: number; // stable React key — see the counter ref in the main component
  checklistCardId: string;
  selectedCardOption: ChecklistCardOption | null;
  serialNumber: string;
  cardFrontImageUrl: string;
  cardBackImageUrl: string;
  notes: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// iPhones save photos as HEIC by default. It's a valid "image/*" file (so it
// passes the file-type check and iOS lets you pick it), but browsers other
// than Safari can't decode HEIC in an <img> tag — it just renders broken.
// file.type is usually "image/heic"/"image/heif", but some browsers leave it
// blank for HEIC files, so the extension is checked too as a fallback.
//
// Neither check is airtight, though: seen in production, a real HEIC photo
// picked via a mobile browser came through with file.type "image/png" and a
// ".png" name — both checks above missed it, so it got uploaded un-converted
// and silently failed to render anywhere. As a last resort, this sniffs the
// file's magic bytes: HEIF's container format (ISO base media) has "ftyp" at
// byte offset 4 followed by a 4-byte brand, and every HEIC/HEIF brand starts
// with "he" or is the generic "mif1"/"msf1" — unlike JPEG/PNG/WEBP.
export async function isHeicFile(file: File): Promise<boolean> {
  if (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  ) {
    return true;
  }

  try {
    const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ftyp = String.fromCharCode(...header.slice(4, 8));
    const brand = String.fromCharCode(...header.slice(8, 12)).trim();
    if (ftyp === "ftyp") {
      return /^(heic|heix|heim|heis|hevc|hevx|mif1|msf1)$/.test(brand);
    }
  } catch {
    // Sniffing failed for some reason — fall through and treat it as a
    // normal image rather than blocking the upload over it.
  }
  return false;
}

// Converts a HEIC file to a JPEG Blob so it can actually be displayed.
// heic2any returns an array only for multi-image HEIC containers (e.g. Live
// Photos) — a card photo is always a single image, so the first result is
// the one we want.
export async function convertHeicToJpeg(file: File): Promise<Blob> {
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

    // Only allow image files — HEIC sometimes reports a blank/wrong
    // file.type, so isHeicFile also checks the extension and, as a last
    // resort, the file's magic bytes.
    const treatAsHeic = await isHeicFile(file);

    if (!file.type.startsWith("image/") && !treatAsHeic) {
      alert("Please select an image file (JPG, PNG, WEBP, etc.)");
      return;
    }

    try {
      let fileToUpload: File = file;

      if (treatAsHeic) {
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
          <Image
            src={value}
            alt="Card preview"
            width={48}
            height={64}
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

// "208/204 Jasmine" — card number first so the dropdown reads in the same
// order it's sorted (by card number), then the player/card name.
function cardOptionTitle(t: ChecklistCardOption): string {
  return t.cardNumber ? `${t.cardNumber} ${t.playerName}` : t.playerName;
}

// Searches the server (GET /api/sets/[id]/checklist/search) instead of
// filtering an in-memory list of every checklist card — a set can have
// thousands of rows (one real set in this app has ~9,700), and the old
// approach meant the set-detail page fetched and held all of them in
// memory on every single load just to power this one search box.
function ChecklistCardSearch({
  setId,
  selected,
  onSelect,
  isLocked,
  category,
}: {
  setId: string;
  selected: ChecklistCardOption | null;
  onSelect: (option: ChecklistCardOption | null) => void;
  isLocked: boolean;
  category: string;
}) {
  const [query, setQuery]     = useState("");
  const [isOpen, setIsOpen]   = useState(false);
  const [filtered, setFiltered] = useState<ChecklistCardOption[]>([]);
  const containerRef          = useRef<HTMLDivElement>(null);

  // Fetches the first page (checklist order) as soon as the box is opened
  // with nothing typed yet, then re-fetches as the user types.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();

    const handle = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ limit: "20" });
        if (trimmed) params.set("q", trimmed);
        const res = await fetch(`/api/sets/${setId}/checklist/search?${params.toString()}`);
        if (!res.ok) return;
        const data = await res.json();
        setFiltered(data.options ?? []);
      } catch {
        setFiltered([]);
      }
    }, trimmed ? 250 : 0);

    return () => clearTimeout(handle);
  }, [query, isOpen, setId]);

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
        <span className="font-semibold">{cardOptionTitle(selected)}</span>
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
            ? [cardOptionTitle(selected), playerSubtitle(selected)].filter(Boolean).join(" ")
            : query
        }
        onChange={(e) => {
          setQuery(e.target.value);
          onSelect(null);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={category === "TCG" ? "Search for a card..." : "Search for a player..."}
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
                  onSelect(t);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-800/80 transition-colors duration-100 border-b border-slate-800/60 last:border-0"
              >
                <p className="text-sm text-slate-200 font-medium">{cardOptionTitle(t)}</p>
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

// ─── COUNTRY SELECT ───────────────────────────────────────────────────────────
// A searchable dropdown over the static COUNTRIES list (see lib/countries.ts)
// — same search-then-pick interaction as ChecklistCardSearch above, but over
// an in-memory list rather than a server fetch. Typing clears any previously
// picked value (via onChange("")) until a list item is actually clicked, so
// a submission can never carry a stale country the user typed over but never
// re-selected.
function CountrySelect({
  value,
  onChange,
  placeholder = "Search for a country...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keeps the visible text in sync when `value` changes externally (e.g.
  // the modal pre-filling a remembered default, or switching between
  // editing/creating a gel).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Revert any unselected typed text back to the real value.
        setQuery(value);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? COUNTRIES.filter((c) => c.toLowerCase().includes(trimmed))
    : COUNTRIES;

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange("");
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
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
            {filtered.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setQuery(c);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2.5 text-left text-sm text-slate-200 font-medium hover:bg-slate-800/80 transition-colors duration-100 border-b border-slate-800/60 last:border-0"
              >
                {c}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── MULTI-CARD BLOCK (Multiple Gels flow) ───────────────────────────────────
// One repeatable Card/Serial/Images/Notes section. Mirrors the "X" remove
// button (only shown when more than one block exists) + "+ Add another"
// text-link pattern already used for repeatable lists in
// components/admin/AdminProductPacksModal.tsx.
function MultiCardBlock({
  entry,
  index,
  canRemove,
  onRemove,
  onChange,
  setId,
  category,
  isOther,
  acquisitionMethod,
}: {
  entry: MultiCardEntry;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<MultiCardEntry>) => void;
  setId: string;
  category: string;
  isOther: boolean;
  // Shared across every entry (same field in the top-level form state) —
  // only needed here to pick the right Notes label below.
  acquisitionMethod: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gel #{index + 1}</p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove entry #${index + 1}`}
            className="shrink-0 p-1 text-red-400/80 hover:text-red-400 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div>
        <Label>Card *</Label>
        <ChecklistCardSearch
          setId={setId}
          selected={entry.selectedCardOption}
          onSelect={(option) => onChange({ checklistCardId: option?.id ?? "", selectedCardOption: option })}
          isLocked={false}
          category={category}
        />
      </div>

      {category !== "TCG" && (
        <div>
          <Label>
            Serial Number{entry.selectedCardOption?.cardTier === "NUMBERED" ? " *" : ""} (if card is numbered 8/10, fill in 8 below)
          </Label>
          <Input
            type="number"
            value={entry.serialNumber}
            onChange={(e) => onChange({ serialNumber: e.target.value })}
            placeholder="e.g. 8"
            min="1"
          />
        </div>
      )}

      <ImageUploadField
        label="Card Front Image *"
        value={entry.cardFrontImageUrl}
        onChange={(v) => onChange({ cardFrontImageUrl: v })}
      />
      <ImageUploadField
        label="Card Back Image"
        value={entry.cardBackImageUrl}
        onChange={(v) => onChange({ cardBackImageUrl: v })}
      />

      <div>
        <Label>
          {!isOther
            ? "Notes"
            : acquisitionMethod === "BREAKER"
            ? "Notes (any additional information)"
            : "Notes (e.g. eBay seller name, @username on Instagram...) *"}
        </Label>
        <Textarea
          value={entry.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder={isOther ? `Type "Unknown" if you're not sure who pulled the card` : "Any extra details about this card..."}
        />
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function AddGelModal({
  isOpen,
  onClose,
  onSuccess,
  setId,
  category,
  setYear,
  products,
  preselectedCardOption,
  editingGel,
  editSubmitUrl,
  claimPrefill,
  coOwnPrefill,
  defaultHitCity,
  defaultHitCountry,
}: AddGelModalProps) {
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [selectedCardOption, setSelectedCardOption] = useState<ChecklistCardOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const modalRef                  = useRef<HTMLDivElement>(null);

  // Set when the server detects a same-checklistCard+serialNumber match on
  // submit — see handleSubmit's 409 handling below. "SELF": this user
  // already logged this exact card (offer to replace it in place).
  // "OTHER": a different user already logged it (offer to file a
  // duplicate case for the developer to review). "CLAIM": this gel is
  // owned (SELF) and the match is only a reported sighting by someone
  // else — offer to claim it as the logger's own physical copy instead.
  const [duplicatePrompt, setDuplicatePrompt] = useState<
    | { kind: "SELF"; existingGel: { id: string; createdAt: string; serialNumber: number | null; cardFrontImageUrl: string | null } }
    | { kind: "OTHER" | "CLAIM"; existingGel: { id: string; createdAt: string; serialNumber: number | null; cardFrontImageUrl: string | null; loggedByName: string; loggedByHandle: string | null } }
    | null
  >(null);
  const [isResolvingDuplicate, setIsResolvingDuplicate] = useState(false);

  // "choice": the "are you logging your own gel or someone else's?" screen.
  // "mode": the "Single Gel" vs "Multiple Gels" screen shown next. "form":
  // the actual log form, in whichever of the four SELF/OTHER × Single/
  // Multiple variants `loggedFor`/`logMode` select. Editing an existing gel
  // skips "choice" and "mode" entirely, going straight to "form" in
  // logMode "single" (editing is always single-gel).
  const [step, setStep]           = useState<"choice" | "mode" | "form">("choice");
  const [loggedFor, setLoggedFor] = useState<LoggedFor>("SELF");
  const [logMode, setLogMode]     = useState<"single" | "multiple">("single");

  // ── Multiple Gels flow state ───────────────────────────────────────────────
  const [multiCards, setMultiCards] = useState<MultiCardEntry[]>([]);
  const multiCardKeyRef = useRef(0);

  function newMultiCardEntry(prefill?: ChecklistCardOption | null): MultiCardEntry {
    multiCardKeyRef.current += 1;
    return {
      key: multiCardKeyRef.current,
      checklistCardId: prefill?.id ?? "",
      selectedCardOption: prefill ?? null,
      serialNumber: "",
      cardFrontImageUrl: "",
      cardBackImageUrl: "",
      notes: "",
    };
  }

  const isEditing = Boolean(editingGel);
  const isOther   = loggedFor === "OTHER";
  // "Which Product" applies to "Pulled" (SELF only — OTHER never offers
  // it) and "Breaker" (either flow, since a break can be an owned pull or
  // a reported sighting) — shared by the single-flow fields, the
  // multi-flow shared fields, and buildBody/handleMultiSubmit below.
  const productApplies = form.acquisitionMethod === "PULLED" || form.acquisitionMethod === "BREAKER";

  // "Year Pulled" options — from the set's release year through the
  // current year, newest first (a card is almost always pulled the year
  // it released or more recently).
  const currentYear = new Date().getFullYear();
  const yearOptions: number[] = [];
  for (let y = currentYear; y >= setYear; y--) yearOptions.push(y);

  // ── Pre-fill when opened — from an existing gel (edit) or a checklist
  // row (create, with the card pre-picked) ──────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (editingGel) {
      // Editing always resumes directly into the form the gel was
      // originally logged under — there's no reassigning SELF ↔ OTHER,
      // and editing is always single-gel.
      setStep("form");
      setLogMode("single");
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
        breakerName:       editingGel.breakerName         ?? "",
        notes:             editingGel.notes               ?? "",
      });
      // GelEntry.cardTemplate has no cardNumber (it's locked anyway, so the
      // search box just won't show the "208/204" prefix in this one case).
      setSelectedCardOption({
        id:            editingGel.cardTemplateId,
        cardNumber:    "",
        playerName:    editingGel.cardTemplate.playerName,
        cardType:      editingGel.cardTemplate.cardType,
        cardTier:      editingGel.cardTemplate.cardTier,
        parallelType:  editingGel.cardTemplate.parallelType  ?? null,
        printRun:      editingGel.cardTemplate.printRun      ?? null,
        variationName: editingGel.cardTemplate.variationName ?? null,
        team:          editingGel.cardTemplate.team          ?? null,
      });
    } else if (claimPrefill) {
      // "Claim this card" — go straight to the SELF/Single form, locked
      // to this specific card+serial. The actual claim is only confirmed
      // server-side when this gets submitted (the same duplicateKind:
      // "CLAIM" 409 flow a normal collision during logging goes through).
      setStep("form");
      setLogMode("single");
      setLoggedFor("SELF");
      setForm({
        ...EMPTY_FORM,
        checklistCardId: claimPrefill.cardOption.id,
        serialNumber:    String(claimPrefill.serialNumber),
        hitCity:         defaultHitCity    ?? "",
        hitCountry:      defaultHitCountry ?? "",
      });
      setSelectedCardOption(claimPrefill.cardOption);
      setMultiCards([newMultiCardEntry(claimPrefill.cardOption)]);
    } else if (coOwnPrefill) {
      // "Did you buy/pull this?" — straight to the SELF/Single form,
      // locked to this card+serial AND this acquisition method (the
      // button clicked determines which). No 409/confirm round-trip —
      // submitting this whole form already is the confirmation (see
      // handleCoOwnSubmit).
      setStep("form");
      setLogMode("single");
      setLoggedFor("SELF");
      setForm({
        ...EMPTY_FORM,
        checklistCardId:   coOwnPrefill.cardOption.id,
        acquisitionMethod: coOwnPrefill.acquisitionMethod,
        serialNumber:       coOwnPrefill.serialNumber != null ? String(coOwnPrefill.serialNumber) : "",
        hitCity:            defaultHitCity    ?? "",
        hitCountry:         defaultHitCountry ?? "",
      });
      setSelectedCardOption(coOwnPrefill.cardOption);
      setMultiCards([newMultiCardEntry(coOwnPrefill.cardOption)]);
    } else {
      setStep("choice");
      setLoggedFor("SELF");
      setLogMode("single");
      setForm({ ...EMPTY_FORM, checklistCardId: preselectedCardOption?.id ?? "" });
      setSelectedCardOption(preselectedCardOption ?? null);
      setMultiCards([newMultiCardEntry(preselectedCardOption)]);
    }
    setError(null);
    setDuplicatePrompt(null);
  }, [isOpen, editingGel, claimPrefill, coOwnPrefill, preselectedCardOption, products, defaultHitCity, defaultHitCountry]);

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

  // ── Multiple Gels: per-entry field updaters ────────────────────────────────
  function updateMultiCard(key: number, patch: Partial<MultiCardEntry>) {
    setMultiCards((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addMultiCard() {
    setMultiCards((prev) => [...prev, newMultiCardEntry()]);
  }
  function removeMultiCard(key: number) {
    setMultiCards((prev) => prev.filter((c) => c.key !== key));
  }

  // ── Body shared by every write this form can make: the initial POST/PATCH,
  // the "File a Duplicate" re-POST, and the "Replace" PATCH onto the
  // pre-existing gel — all send the exact same fields. `extra` layers on
  // whatever distinguishes the specific request (e.g. acknowledgeDuplicate).
  function buildBody(extra?: Record<string, unknown>) {
    // "Which Product" applies to "Pulled" (SELF only) and "Breaker"
    // (either flow) — resolve the chosen ProductOption's id back to the
    // raw productType/productTypeOther pair the server stores.
    const selectedProduct = productApplies
      ? products.find((p) => p.id === form.productOptionId)
      : undefined;

    return {
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
      breakerName:       form.acquisitionMethod === "BREAKER" ? (form.breakerName || null) : null,
      notes:             form.notes  || null,
      ...extra,
    };
  }

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

    if (!form.acquisitionMethod) {
      setError("Please select how you got this card.");
      return;
    }

    if (form.acquisitionMethod === "BREAKER" && !form.breakerName.trim()) {
      setError("Please fill in the breaker's name.");
      return;
    }

    if (isOther && form.acquisitionMethod !== "BREAKER" && !form.notes.trim()) {
      setError("Please fill in the notes.");
      return;
    }

    if (productApplies && !form.productOptionId) {
      setError("Please select which product this came from.");
      return;
    }

    if (category !== "TCG" && selectedCardOption?.cardTier === "NUMBERED" && !form.serialNumber) {
      setError("This card is numbered — please fill in the serial number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const url = isEditing
        ? (editSubmitUrl ?? `/api/sets/${setId}/gels/${editingGel!.id}`)
        : `/api/sets/${setId}/gels`;

      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });

      const data = await res.json();

      if (!res.ok) {
        // A fresh (non-edit) log can collide with an existing serialized
        // gel — see app/api/sets/[id]/gels/route.ts. Editing never hits
        // this (duplicate-checking is create-only), so isEditing is never
        // true here in practice.
        if (res.status === 409 && ["SELF", "OTHER", "CLAIM"].includes(data.duplicateKind)) {
          setDuplicatePrompt({ kind: data.duplicateKind, existingGel: data.existingGel });
          return;
        }
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

  // ── Resolve the "you already logged this" prompt: replace the existing
  // gel in place via the same PATCH an edit would use. ──────────────────────
  async function handleReplaceExisting() {
    if (!duplicatePrompt || duplicatePrompt.kind !== "SELF") return;
    setIsResolvingDuplicate(true);
    try {
      const res = await fetch(`/api/sets/${setId}/gels/${duplicatePrompt.existingGel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setDuplicatePrompt(null);
        return;
      }
      onSuccess(data.gel as GelEntry);
      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setDuplicatePrompt(null);
    } finally {
      setIsResolvingDuplicate(false);
    }
  }

  // ── Resolve the "someone else already logged this" or "claim this
  // card" prompt: proceed with logging anyway — the server decides
  // whether this opens a DUPLICATE or CLAIM file from the gels' own
  // isInHand values, not from anything this function asserts. ───────────
  async function handleFileDuplicate() {
    if (!duplicatePrompt || (duplicatePrompt.kind !== "OTHER" && duplicatePrompt.kind !== "CLAIM")) return;
    setIsResolvingDuplicate(true);
    try {
      const res = await fetch(`/api/sets/${setId}/gels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody({ acknowledgeDuplicate: true })),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setDuplicatePrompt(null);
        return;
      }
      onSuccess(data.gel as GelEntry);
      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setDuplicatePrompt(null);
    } finally {
      setIsResolvingDuplicate(false);
    }
  }

  // ── "Did you buy/pull this?" submit — posts straight to the co-claim
  // endpoint, no 409/confirm round-trip (filling out this whole form
  // already is the confirmation). ───────────────────────────────────────────
  function buildCoOwnBody() {
    const selectedProduct = productApplies
      ? products.find((p) => p.id === form.productOptionId)
      : undefined;

    return {
      targetGelId:       coOwnPrefill!.targetGelId,
      acquisitionMethod: form.acquisitionMethod || null,
      productType:       selectedProduct?.productType ?? null,
      productTypeOther:  selectedProduct?.productTypeOther ?? null,
      hitYear:           form.hitYear   ? parseInt(form.hitYear)   : null,
      hitMonth:          form.hitMonth  ? parseInt(form.hitMonth)  : null,
      hitCity:           form.hitCity   || null,
      hitCountry:        form.hitCountry || null,
      cardFrontImageUrl: form.cardFrontImageUrl || null,
      cardBackImageUrl:  form.cardBackImageUrl  || null,
      seller:            form.seller || null,
      breakerName:       form.acquisitionMethod === "BREAKER" ? (form.breakerName || null) : null,
      notes:             form.notes  || null,
    };
  }

  async function handleCoOwnSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.cardFrontImageUrl) {
      setError("Please upload a card front image.");
      return;
    }

    if (productApplies && !form.productOptionId) {
      setError("Please select which product this came from.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/sets/${setId}/gels/co-claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCoOwnBody()),
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

  // ── Multiple Gels: submit ──────────────────────────────────────────────────
  // All entries share the acquisition/product/date/location fields in
  // `form` — see app/api/sets/[id]/gels/batch/route.ts for the exact wire
  // shape this builds.
  async function handleMultiSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.acquisitionMethod) {
      setError("Please select how you got these cards.");
      return;
    }

    if (form.acquisitionMethod === "BREAKER" && !form.breakerName.trim()) {
      setError("Please fill in the breaker's name.");
      return;
    }

    if (productApplies && !form.productOptionId) {
      setError("Please select which product these cards came from.");
      return;
    }

    for (let i = 0; i < multiCards.length; i++) {
      const c = multiCards[i];
      if (!c.checklistCardId) {
        setError(`Please select a card for entry #${i + 1}.`);
        return;
      }
      if (!c.cardFrontImageUrl) {
        setError(`Please upload a card front image for entry #${i + 1}.`);
        return;
      }
      if (category !== "TCG" && c.selectedCardOption?.cardTier === "NUMBERED" && !c.serialNumber) {
        setError(`Entry #${i + 1}: this card is numbered — please fill in the serial number.`);
        return;
      }
      if (isOther && form.acquisitionMethod !== "BREAKER" && !c.notes.trim()) {
        setError(`Entry #${i + 1}: please fill in the notes.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedProduct = productApplies
        ? products.find((p) => p.id === form.productOptionId)
        : undefined;

      const res = await fetch(`/api/sets/${setId}/gels/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loggedFor,
          acquisitionMethod: form.acquisitionMethod || null,
          productType:       selectedProduct?.productType ?? null,
          productTypeOther:  selectedProduct?.productTypeOther ?? null,
          hitYear:    form.hitYear   ? parseInt(form.hitYear)   : null,
          hitMonth:   form.hitMonth  ? parseInt(form.hitMonth)  : null,
          hitCity:    form.hitCity   || null,
          hitCountry: form.hitCountry || null,
          seller:     form.seller || null,
          breakerName: form.acquisitionMethod === "BREAKER" ? (form.breakerName || null) : null,
          cards: multiCards.map((c) => ({
            cardTemplateId:    c.checklistCardId,
            serialNumber:      c.serialNumber ? parseInt(c.serialNumber) : null,
            cardFrontImageUrl: c.cardFrontImageUrl || null,
            cardBackImageUrl:  c.cardBackImageUrl  || null,
            notes:             c.notes || null,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (typeof data.cardIndex === "number") {
          setError(`Entry #${data.cardIndex + 1}: ${data.error}`);
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      for (const gel of data.gels as GelEntry[]) {
        onSuccess(gel);
      }
      onClose();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmitMulti =
    Boolean(form.acquisitionMethod) &&
    (form.acquisitionMethod !== "BREAKER" || form.breakerName.trim()) &&
    (!productApplies || Boolean(form.productOptionId)) &&
    multiCards.length > 0 &&
    multiCards.every((c) =>
      c.checklistCardId &&
      c.cardFrontImageUrl &&
      (category === "TCG" || c.selectedCardOption?.cardTier !== "NUMBERED" || c.serialNumber) &&
      (!isOther || form.acquisitionMethod === "BREAKER" || c.notes.trim())
    );

  return (
    <>
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
                      // Only "My Own Gel" pre-fills City/Country from this
                      // user's own remembered last submission.
                      setForm((prev) => ({
                        ...prev,
                        acquisitionMethod: "",
                        seller: "",
                        hitCity:    defaultHitCity    ?? "",
                        hitCountry: defaultHitCountry ?? "",
                      }));
                      setStep("mode");
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
                      // Someone else's gel never gets the SELF-only City/
                      // Country defaults — clear them in case "My Own Gel"
                      // was clicked first (prefilling them) before Back.
                      setForm((prev) => ({
                        ...prev,
                        acquisitionMethod: "",
                        seller: "",
                        hitCity: "",
                        hitCountry: "",
                      }));
                      setStep("mode");
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
            ) : step === "mode" ? (
              <div className="p-6 space-y-5">
                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                  <div>
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
                    <h2 className="text-lg font-bold text-white">Log a Gel</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Are you logging one card, or several at once?
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

                {/* ── Mode buttons ─────────────────────────────────────────── */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setLogMode("single");
                      setStep("form");
                    }}
                    className="w-full flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-blue-500/60 hover:bg-slate-800 text-left transition-all duration-150"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Single Gel</p>
                      <p className="text-xs text-slate-400 mt-0.5">Log one card at a time.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLogMode("multiple");
                      setMultiCards((prev) => (prev.length > 0 ? prev : [newMultiCardEntry(preselectedCardOption)]));
                      setStep("form");
                    }}
                    className="w-full flex items-start gap-3 p-4 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/60 hover:bg-slate-800 text-left transition-all duration-150"
                  >
                    <div className="shrink-0 w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="13" height="17" rx="2" />
                        <path d="M19 7v13a1 1 0 0 1-1 1H9" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Multiple Gels</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {isOther
                          ? "Log multiple cards you saw from the same person."
                          : "Log multiple cards that were pulled or bought at the same time."}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={coOwnPrefill ? handleCoOwnSubmit : logMode === "multiple" ? handleMultiSubmit : handleSubmit} className="p-6 space-y-5">
              {/* ── Header ───────────────────────────────────────────────── */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {!isEditing && !claimPrefill && !coOwnPrefill && (
                    <button
                      type="button"
                      onClick={() => setStep("mode")}
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
                      : logMode === "multiple"
                        ? isOther
                          ? "Record several cards you saw someone else pull or sell."
                          : "Record several cards you pulled or purchased from this set."
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

              {logMode === "single" ? (
                <>
                  {/* ── Card Selection ───────────────────────────────────── */}
                  <div>
                    <Label>Card *</Label>
                    <ChecklistCardSearch
                      setId={setId}
                      selected={selectedCardOption}
                      onSelect={(option) => {
                        setForm((prev) => ({ ...prev, checklistCardId: option?.id ?? "" }));
                        setSelectedCardOption(option);
                      }}
                      isLocked={Boolean(preselectedCardOption) || isEditing || Boolean(claimPrefill) || Boolean(coOwnPrefill)}
                      category={category}
                    />
                  </div>

                  {/* ── Serial Number — sits right after Card. TCG cards
                      aren't reliably serial-numbered, so this field is
                      hidden entirely for TCG sets (both SELF and OTHER). ── */}
                  {category !== "TCG" && (
                    <div>
                      <Label>
                        Serial Number{selectedCardOption?.cardTier === "NUMBERED" ? " *" : ""} (if card is numbered 8/10, fill in 8 below)
                      </Label>
                      <Input
                        type="number"
                        value={form.serialNumber}
                        onChange={setField("serialNumber")}
                        placeholder="e.g. 8"
                        min="1"
                        disabled={Boolean(coOwnPrefill)}
                      />
                    </div>
                  )}

                  {/* ── Acquisition Method — locked when coOwnPrefill is set
                      (the "Did you buy/pull this?" button already decided
                      which) ──────────────────────────────────────────────── */}
                  <div>
                    <Label>{isOther ? "Where did you see it? *" : "How did you get it? *"}</Label>
                    <Select
                      value={form.acquisitionMethod}
                      disabled={Boolean(coOwnPrefill)}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          acquisitionMethod: value,
                          // "Which Product" applies to "Pulled"/"Breaker" —
                          // clear any selection made while it was briefly enabled.
                          productOptionId: value === "PULLED" || value === "BREAKER" ? prev.productOptionId : "",
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
                          <option value="OTHER" className="bg-slate-900">Other</option>
                        </>
                      )}
                    </Select>
                  </div>

                  {/* ── Breaker's Name (conditional on BREAKER, either flow) ── */}
                  <AnimatePresence>
                    {form.acquisitionMethod === "BREAKER" && (
                      <motion.div
                        key="breakerName"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Label>Breaker&apos;s Name *</Label>
                        <Input
                          value={form.breakerName}
                          onChange={setField("breakerName")}
                          placeholder="e.g. @username, breaker's name..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Which Product (shown for SELF always, and for OTHER
                      when the source is a breaker — enabled once "Pulled"
                      or "Breaker" is selected) ───────────────────────────── */}
                  {(!isOther || form.acquisitionMethod === "BREAKER") && (
                    <div>
                      <Label>Which Product *</Label>
                      <Select
                        value={form.productOptionId}
                        onChange={setField("productOptionId")}
                        disabled={!productApplies}
                      >
                        {!productApplies ? (
                          <option value="" className="bg-slate-900">Select product...</option>
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

                  {/* ── Hit Date ─────────────────────────────────────────── */}
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
                      <Select value={form.hitYear} onChange={setField("hitYear")}>
                        <option value="" className="bg-slate-900">Year...</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y} className="bg-slate-900">{y}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* ── Hit Location ─────────────────────────────────────── */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{form.acquisitionMethod === "BREAKER" ? "City (of the breaker)" : "City"}</Label>
                      <Input
                        value={form.hitCity}
                        onChange={setField("hitCity")}
                      />
                    </div>
                    <div>
                      <Label>{form.acquisitionMethod === "BREAKER" ? "Country (of the breaker)" : "Country"}</Label>
                      <CountrySelect
                        value={form.hitCountry}
                        onChange={(v) => setForm((prev) => ({ ...prev, hitCountry: v }))}
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

                  {/* ── Notes ────────────────────────────────────────────── */}
                  <div>
                    <Label>
                      {!isOther
                        ? "Notes"
                        : form.acquisitionMethod === "BREAKER"
                        ? "Notes (any additional information)"
                        : "Notes (e.g. eBay seller name, @username on Instagram...) *"}
                    </Label>
                    <Textarea
                      value={form.notes}
                      onChange={setField("notes")}
                      placeholder={isOther ? `Type "Unknown" if you're not sure who pulled the card` : "Any extra details about this card..."}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* ── Shared fields — every card below uses these ──────── */}
                  <div>
                    <Label>{isOther ? "Where did you see it? *" : "How did you get it? *"}</Label>
                    <Select
                      value={form.acquisitionMethod}
                      onChange={(e) => {
                        const value = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          acquisitionMethod: value,
                          productOptionId: value === "PULLED" || value === "BREAKER" ? prev.productOptionId : "",
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
                          <option value="OTHER" className="bg-slate-900">Other</option>
                        </>
                      )}
                    </Select>
                  </div>

                  <AnimatePresence>
                    {form.acquisitionMethod === "BREAKER" && (
                      <motion.div
                        key="breakerName"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <Label>Breaker&apos;s Name *</Label>
                        <Input
                          value={form.breakerName}
                          onChange={setField("breakerName")}
                          placeholder="e.g. @username, breaker's name..."
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {(!isOther || form.acquisitionMethod === "BREAKER") && (
                    <div>
                      <Label>Which Product *</Label>
                      <Select
                        value={form.productOptionId}
                        onChange={setField("productOptionId")}
                        disabled={!productApplies}
                      >
                        {!productApplies ? (
                          <option value="" className="bg-slate-900">Select product...</option>
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
                      <Select value={form.hitYear} onChange={setField("hitYear")}>
                        <option value="" className="bg-slate-900">Year...</option>
                        {yearOptions.map((y) => (
                          <option key={y} value={y} className="bg-slate-900">{y}</option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>{form.acquisitionMethod === "BREAKER" ? "City (of the breaker)" : "City"}</Label>
                      <Input
                        value={form.hitCity}
                        onChange={setField("hitCity")}
                      />
                    </div>
                    <div>
                      <Label>{form.acquisitionMethod === "BREAKER" ? "Country (of the breaker)" : "Country"}</Label>
                      <CountrySelect
                        value={form.hitCountry}
                        onChange={(v) => setForm((prev) => ({ ...prev, hitCountry: v }))}
                      />
                    </div>
                  </div>

                  {/* ── Repeating Card/Serial/Images/Notes blocks ────────── */}
                  <div className="space-y-4">
                    {multiCards.map((entry, i) => (
                      <MultiCardBlock
                        key={entry.key}
                        entry={entry}
                        index={i}
                        canRemove={multiCards.length > 1}
                        onRemove={() => removeMultiCard(entry.key)}
                        onChange={(patch) => updateMultiCard(entry.key, patch)}
                        setId={setId}
                        category={category}
                        isOther={isOther}
                        acquisitionMethod={form.acquisitionMethod}
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addMultiCard}
                    className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    + Add another Gel
                  </button>
                </>
              )}

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
                    (logMode === "multiple"
                      ? !canSubmitMulti
                      : !form.checklistCardId ||
                        !form.cardFrontImageUrl ||
                        !form.acquisitionMethod ||
                        (form.acquisitionMethod === "BREAKER" && !form.breakerName.trim()) ||
                        (isOther && form.acquisitionMethod !== "BREAKER" && !form.notes.trim()) ||
                        (productApplies && !form.productOptionId) ||
                        (category !== "TCG" && selectedCardOption?.cardTier === "NUMBERED" && !form.serialNumber))
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

    {/* ── Duplicate-gel confirm dialog — sits above the form, which stays
        mounted underneath until this is resolved ─────────────────────────── */}
    <AnimatePresence>
      {duplicatePrompt && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-x-4 bottom-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[70] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl shadow-black/60"
            role="alertdialog"
            aria-modal="true"
            aria-label="Possible duplicate gel"
          >
            <div className={`h-1 w-full rounded-t-2xl ${
              duplicatePrompt.kind === "SELF" ? "bg-blue-500" : duplicatePrompt.kind === "CLAIM" ? "bg-purple-500" : "bg-amber-500"
            }`} />
            <div className="p-5 space-y-4">
              {duplicatePrompt.kind === "SELF" ? (
                <>
                  <h2 className="text-base font-bold text-white">You&apos;ve already logged this gel</h2>
                  <p className="text-sm text-slate-400">
                    You logged serial #{duplicatePrompt.existingGel.serialNumber} for this card on{" "}
                    {new Date(duplicatePrompt.existingGel.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
                    Would you like to replace that entry with these details?
                  </p>
                </>
              ) : duplicatePrompt.kind === "CLAIM" ? (
                <>
                  <h2 className="text-base font-bold text-white">Claim this card?</h2>
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-200 font-semibold">{duplicatePrompt.existingGel.loggedByName}</span> reported
                    seeing serial #{duplicatePrompt.existingGel.serialNumber} for this card on{" "}
                    {new Date(duplicatePrompt.existingGel.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
                    Would you like to claim it as your own?
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-white">Someone else already logged this card</h2>
                  <p className="text-sm text-slate-400">
                    <span className="text-slate-200 font-semibold">{duplicatePrompt.existingGel.loggedByName}</span> already
                    logged serial #{duplicatePrompt.existingGel.serialNumber} for this card on{" "}
                    {new Date(duplicatePrompt.existingGel.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.
                    Please double check your info — including the serial number and parallel — before continuing.
                  </p>
                </>
              )}

              {duplicatePrompt.existingGel.cardFrontImageUrl && (
                <div className="flex justify-center">
                  <Image
                    src={duplicatePrompt.existingGel.cardFrontImageUrl}
                    alt=""
                    width={64}
                    height={88}
                    className="w-16 h-[88px] object-cover rounded-sm border border-slate-700/50"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isResolvingDuplicate}
                  onClick={() => setDuplicatePrompt(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-700/60 text-slate-300 text-sm font-semibold hover:bg-slate-800/60 disabled:opacity-40 transition-colors duration-150"
                >
                  {duplicatePrompt.kind === "SELF" ? "Cancel" : "Back"}
                </button>
                <button
                  type="button"
                  disabled={isResolvingDuplicate}
                  onClick={duplicatePrompt.kind === "SELF" ? handleReplaceExisting : handleFileDuplicate}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-40 transition-colors duration-150 shadow-lg ${
                    duplicatePrompt.kind === "SELF"
                      ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/30"
                      : duplicatePrompt.kind === "CLAIM"
                      ? "bg-purple-600 hover:bg-purple-500 shadow-purple-900/30"
                      : "bg-amber-600 hover:bg-amber-500 shadow-amber-900/30"
                  }`}
                >
                  {isResolvingDuplicate
                    ? "Saving..."
                    : duplicatePrompt.kind === "SELF"
                    ? "Replace"
                    : duplicatePrompt.kind === "CLAIM"
                    ? "Claim this Card"
                    : "File a Duplicate"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
}
