// components/set-detail/SetDetailClient.tsx

"use client";

import { useState, useCallback, useTransition } from "react";
import SetHeader from "./SetHeader";
import YourGels, { type GelEntry } from "./YourGels";
import ChecklistTable, {
  type ChecklistRow,
  type ChecklistMeta,
} from "./ChecklistTable";
import AddGelModal, { type CardTemplateOption } from "./AddGelModal";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SetDetailClientProps {
  // Set metadata
  setId:                 string;
  setName:               string;
  subCategory:           string;
  year:                  number;
  brand:                 string;
  totalCardsInSet:       number;
  totalChaseCardsInSet?: number | null;
  imageUrl?:             string | null;

  // User's gels for this set
  initialGels: GelEntry[];

  // Checklist (first page, pre-fetched server-side)
  initialRows:    ChecklistRow[];
  initialMeta:    ChecklistMeta;
  availableTeams: string[];
  availableCategories: string[];   // ✅ NEW

  // All card templates for the Add Gel modal search
  allTemplates: CardTemplateOption[];
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function SetDetailClient({
  setId,
  setName,
  subCategory,
  year,
  brand,
  totalCardsInSet,
  totalChaseCardsInSet,
  imageUrl,
  initialGels,
  initialRows,
  initialMeta,
  availableTeams,
  availableCategories,   // ✅ NEW
  allTemplates,
}: SetDetailClientProps) {

  // ── Gel state ──────────────────────────────────────────────────────────────
  const [gels, setGels] = useState<GelEntry[]>(initialGels);

  // ── Checklist state ────────────────────────────────────────────────────────
  const [rows, setRows]                         = useState<ChecklistRow[]>(initialRows);
  const [meta, setMeta]                         = useState<ChecklistMeta>(initialMeta);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [, startTransition]                     = useTransition();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]                         = useState(false);
  const [preselectedTemplateId, setPreselectedTemplateId] = useState<string | null>(null);
  const [preselectedPlayerName, setPreselectedPlayerName] = useState<string | null>(null);

  // ── Open modal ─────────────────────────────────────────────────────────────
  const handleAddGelClick = useCallback(
    (templateId?: string, playerName?: string) => {
      setPreselectedTemplateId(templateId ?? null);
      setPreselectedPlayerName(playerName ?? null);
      setModalOpen(true);
    },
    []
  );

  // ── Close modal ────────────────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setPreselectedTemplateId(null);
    setPreselectedPlayerName(null);
  }, []);

  // ── On successful gel add ──────────────────────────────────────────────────
  // FIX: The old code set `isOwned: true` here, but ChecklistRow no longer has
  // an `isOwned` boolean — it was replaced with `status: "Available" | "Owned"
  // | "Surfaced"`. We now set `status: "Owned"` to mark the row as owned
  // immediately after the user logs a gel, without waiting for a data refetch.
  const handleGelSuccess = useCallback(
    (newGel: GelEntry) => {
      setGels((prev) => [newGel, ...prev]);
      setRows((prev) =>
        prev.map((r) =>
          r.id === newGel.cardTemplateId
            ? { ...r, status: "Owned" as const, ownedGelId: newGel.id }
            : r
        )
      );
    },
    []
  );

  // ── Checklist filter/page change ───────────────────────────────────────────
  const handleFilterChange = useCallback(
    async (filters: {
      search?:     string;
      filterType?: string | null;
      filterTeam?: string | null;
      page?:       number;
    }) => {
      setChecklistLoading(true);

      try {
        const params = new URLSearchParams();
        if (filters.search)      params.set("search", filters.search);
        if (filters.filterType)  params.set("type",   filters.filterType);
        if (filters.filterTeam)  params.set("team",   filters.filterTeam);
        if (filters.page)        params.set("page",   String(filters.page));

        const res = await fetch(`/api/sets/${setId}/checklist?${params.toString()}`);

        if (!res.ok) {
          console.error("Failed to fetch checklist");
          return;
        }

        const data = await res.json();

        startTransition(() => {
          setRows(data.rows);
          setMeta(data.meta);
        });
      } catch (err) {
        console.error("Checklist fetch error:", err);
      } finally {
        setChecklistLoading(false);
      }
    },
    [setId]
  );

  // ── Derived stats ──────────────────────────────────────────────────────────
  const userGelCount     = gels.length;
  const cardsOpenedCount = gels.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── 1. Set Header ─────────────────────────────────────────── */}
        <SetHeader
          setName={setName}
          sport={subCategory}
          year={year}
          manufacturer={brand}
          totalCardsInSet={totalCardsInSet}
          totalChaseCardsInSet={totalChaseCardsInSet}
          userGelCount={userGelCount}
          cardsOpenedCount={cardsOpenedCount}
          setImageUrl={imageUrl}
        />

        {/* ── 2. Your Gels ──────────────────────────────────────────── */}
        <YourGels
          gels={gels}
          onAddGelClick={() => handleAddGelClick()}
        />

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="h-px w-full bg-slate-800/60" />

        {/* ── 3. Full Checklist ─────────────────────────────────────── */}
        <ChecklistTable
          rows={rows}
          meta={meta}
          setId={setId}
          onAddGelClick={handleAddGelClick}
          onFilterChange={handleFilterChange}
          isLoading={checklistLoading}
          availableTeams={availableTeams}
          availableCategories={availableCategories}   // ✅ NEW
        />
      </div>

      {/* ── 4. Add Gel Modal ──────────────────────────────────────────── */}
      <AddGelModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleGelSuccess}
        setId={setId}
        templates={allTemplates}
        preselectedTemplateId={preselectedTemplateId}
        preselectedPlayerName={preselectedPlayerName}
      />
    </div>
  );
}
