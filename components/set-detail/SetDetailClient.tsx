// components/set-detail/SetDetailClient.tsx

"use client";

import { useState, useCallback, useTransition } from "react";
import SetHeader from "./SetHeader";
import YourGels, { type GelEntry } from "./YourGels";
import ChecklistTable, {
  type ChecklistRow,
  type ChecklistMeta,
} from "./ChecklistTable";
import AddGelModal, { type ChecklistCardOption, type ProductOption } from "./AddGelModal";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface SetDetailClientProps {
  // Set metadata
  setId:                 string;
  setName:               string;
  category:              string; // "SPORTS" | "ENTERTAINMENT" | "TCG"
  subCategory:           string;
  year:                  number;
  brand:                 string;
  totalPrintRunInSet:    number;
  chasesPulledInSet:     number;
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
  allTemplates: ChecklistCardOption[];

  // This set's admin-curated product catalog — powers "Which Product"
  products: ProductOption[];
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function SetDetailClient({
  setId,
  setName,
  category,
  subCategory,
  year,
  brand,
  totalPrintRunInSet,
  chasesPulledInSet,
  totalChaseCardsInSet,
  imageUrl,
  initialGels,
  initialRows,
  initialMeta,
  availableTeams,
  availableCategories,   // ✅ NEW
  allTemplates,
  products,
}: SetDetailClientProps) {

  // ── Gel state ──────────────────────────────────────────────────────────────
  const [gels, setGels] = useState<GelEntry[]>(initialGels);
  // Set-wide "Chases Pulled" total (see lib/data/sets.ts) — distinct from
  // gels.length, which is just this viewer's own collection. Bumped
  // optimistically only when the viewer logs their OWN gel for the first
  // time (it counts immediately); a "someone else's gel" report doesn't
  // count until the developer verifies it, which happens outside this page.
  const [chasesPulled, setChasesPulled] = useState(chasesPulledInSet);

  // ── Checklist state ────────────────────────────────────────────────────────
  const [rows, setRows]                         = useState<ChecklistRow[]>(initialRows);
  const [meta, setMeta]                         = useState<ChecklistMeta>(initialMeta);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [, startTransition]                     = useTransition();

  // ── Modal state ────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen]                                     = useState(false);
  const [preselectedChecklistCardId, setPreselectedChecklistCardId]   = useState<string | null>(null);
  const [preselectedPlayerName, setPreselectedPlayerName]             = useState<string | null>(null);
  const [editingGel, setEditingGel]                                   = useState<GelEntry | null>(null);

  // ── Open modal (create) ─────────────────────────────────────────────────────
  const handleAddGelClick = useCallback(
    (checklistCardId?: string, playerName?: string) => {
      setEditingGel(null);
      setPreselectedChecklistCardId(checklistCardId ?? null);
      setPreselectedPlayerName(playerName ?? null);
      setModalOpen(true);
    },
    []
  );

  // ── Open modal (edit) ───────────────────────────────────────────────────────
  const handleEditGelClick = useCallback((gel: GelEntry) => {
    setEditingGel(gel);
    setPreselectedChecklistCardId(null);
    setPreselectedPlayerName(null);
    setModalOpen(true);
  }, []);

  // ── Close modal ────────────────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setPreselectedChecklistCardId(null);
    setPreselectedPlayerName(null);
    setEditingGel(null);
  }, []);

  // ── On successful gel add or edit ───────────────────────────────────────────
  // ChecklistRow's status is "Available" | "Owned" | "Surfaced" — a gel the
  // user actually has in hand (isInHand: true, the default/"logging my own
  // gel" path) marks the row "Owned" and joins "Your Gels"; a reported
  // sighting of someone else's gel (isInHand: false, the "someone else's
  // gel" path) marks it "Surfaced" instead and is excluded from "Your Gels"
  // entirely, since that list is the user's own collection.
  const handleGelSuccess = useCallback(
    (gel: GelEntry) => {
      const isSurfaced = gel.isInHand === false;
      const newStatus: "Owned" | "Surfaced" = isSurfaced ? "Surfaced" : "Owned";
      let isNewGel = false;

      setGels((prev) => {
        if (isSurfaced) {
          return prev.filter((g) => g.id !== gel.id);
        }
        const alreadyExists = prev.some((g) => g.id === gel.id);
        isNewGel = !alreadyExists;
        return alreadyExists
          ? prev.map((g) => (g.id === gel.id ? gel : g))
          : [gel, ...prev];
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === gel.cardTemplateId
            ? { ...r, status: newStatus, ownedGelId: gel.id }
            : r
        )
      );
      // A brand-new own gel always counts toward the set-wide "Chases
      // Pulled" total immediately; a "someone else's gel" report doesn't
      // until the developer verifies it over on /admin/gels.
      if (isNewGel && !isSurfaced) {
        setChasesPulled((prev) => prev + 1);
      }
    },
    []
  );

  // ── Delete a gel ─────────────────────────────────────────────────────────────
  const handleDeleteGel = useCallback(
    async (gelId: string) => {
      const res = await fetch(`/api/sets/${setId}/gels/${gelId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete gel");
      }
      setGels((prev) => prev.filter((g) => g.id !== gelId));
      // Every gel in "Your Gels" is isInHand: true, so it always counted
      // toward the set-wide total — removing it always decrements that too.
      setChasesPulled((prev) => Math.max(0, prev - 1));
    },
    [setId]
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
  const userGelCount = gels.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── 1. Set Header ─────────────────────────────────────────── */}
        <SetHeader
          setName={setName}
          sport={subCategory}
          year={year}
          manufacturer={brand}
          totalPrintRunInSet={totalPrintRunInSet}
          totalChaseCardsInSet={totalChaseCardsInSet}
          userGelCount={userGelCount}
          chasesPulled={chasesPulled}
          setImageUrl={imageUrl}
        />

        {/* ── 2. Your Gels ──────────────────────────────────────────── */}
        <YourGels
          gels={gels}
          onAddGelClick={() => handleAddGelClick()}
          onEditGel={handleEditGelClick}
          onDeleteGel={handleDeleteGel}
        />

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="h-px w-full bg-slate-800/60" />

        {/* ── 3. Full Checklist ─────────────────────────────────────── */}
        <ChecklistTable
          rows={rows}
          meta={meta}
          setId={setId}
          category={category}
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
        products={products}
        preselectedChecklistCardId={preselectedChecklistCardId}
        preselectedPlayerName={preselectedPlayerName}
        editingGel={editingGel}
      />
    </div>
  );
}
