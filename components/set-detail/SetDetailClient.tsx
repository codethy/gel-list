// components/set-detail/SetDetailClient.tsx

"use client";

import { useState, useCallback, useTransition } from "react";
import { useSession } from "next-auth/react";
import SetHeader from "./SetHeader";
import YourGels, { type GelEntry } from "./YourGels";
import RecentPulls from "./RecentPulls";
import ChecklistTable, {
  type ChecklistRow,
  type ChecklistMeta,
} from "./ChecklistTable";
import AddGelModal, { type ChecklistCardOption, type ProductOption, type ClaimPrefill, type CoOwnPrefill } from "./AddGelModal";
import SignInRequiredModal from "@/components/SignInRequiredModal";
import PacksOpenedBreakdownModal from "./PacksOpenedBreakdownModal";
import LogProductOpeningsModal, { type OpeningEntry } from "./LogProductOpeningsModal";
import type { SetPacksOpenedSummary } from "@/lib/data/productOpenings";

// Matches RECENT_PULLS_LIMIT in lib/data/sets.ts — keeps the client-side
// feed from growing unbounded across a long session once new pulls are
// prepended locally (see handleGelSuccess below).
const RECENT_PULLS_LIMIT = 12;

// Matches YOUR_GELS_DISPLAY_LIMIT in lib/data/sets.ts.
const YOUR_GELS_DISPLAY_LIMIT = 6;

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
  // For TCG sets specifically, "Chases in Set" shows this plain row count
  // instead of totalPrintRunInSet — there's no reliable print run to sum
  // for TCG cards, so estimating one (the usual default-10-per-card
  // fallback) isn't meaningful there. See SetHeader.tsx.
  totalCardsInSet:       number;
  chasesPulledInSet:     number;
  totalChaseCardsInSet?: number | null;
  imageUrl?:             string | null;

  // User's gels for this set
  initialGels: GelEntry[];
  // The viewer's YourGelsPin order for this set, if they've customized
  // which YOUR_GELS_DISPLAY_LIMIT of initialGels "Your Gels" shows — see
  // lib/data/sets.ts's yourGelsPinnedIds.
  initialYourGelsPinnedIds: string[];
  recentPulls: GelEntry[];

  // Checklist (first page, pre-fetched server-side)
  initialRows:    ChecklistRow[];
  initialMeta:    ChecklistMeta;
  availableTeams: string[];
  availableCategories: string[];   // ✅ NEW
  availableTiers: string[];

  // This set's admin-curated product catalog — powers "Which Product"
  products: ProductOption[];

  // "X Packs/Boxes Opened" box + its two linked popups
  initialPacksOpened: SetPacksOpenedSummary;

  // Pre-fills "Log a Gel"'s City/Country fields (SELF flow only) — see
  // lib/data/userGelDefaults.ts.
  userLastGelCity:    string | null;
  userLastGelCountry: string | null;
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
  totalCardsInSet,
  chasesPulledInSet,
  totalChaseCardsInSet,
  imageUrl,
  initialGels,
  initialYourGelsPinnedIds,
  recentPulls: initialRecentPulls,
  initialRows,
  initialMeta,
  availableTeams,
  availableCategories,   // ✅ NEW
  availableTiers,
  products,
  initialPacksOpened,
  userLastGelCity: initialUserLastGelCity,
  userLastGelCountry: initialUserLastGelCountry,
}: SetDetailClientProps) {
  const { data: session, status: sessionStatus } = useSession();

  // ── Gel state ──────────────────────────────────────────────────────────────
  const [gels, setGels] = useState<GelEntry[]>(initialGels);
  // "Your Gels" display picks for this set — empty until the user
  // customizes via YourGels' "Manage Display" modal (only offered once
  // gels.length exceeds YOUR_GELS_DISPLAY_LIMIT). Derived display list
  // (not its own state) so it automatically stays correct as `gels`
  // changes from logging/editing/deleting — a pinned id that no longer
  // resolves to a gel (e.g. deleted) is silently dropped by the .filter.
  const [yourGelsPinnedIds, setYourGelsPinnedIds] = useState<string[]>(initialYourGelsPinnedIds);
  const displayedYourGels = yourGelsPinnedIds.length > 0
    ? yourGelsPinnedIds
        .map((id) => gels.find((g) => g.id === id))
        .filter((g): g is GelEntry => Boolean(g))
    : gels.slice(0, YOUR_GELS_DISPLAY_LIMIT);
  // Live feed across every user — lifted into state (rather than used
  // straight from the prop) so a gel logged in this same session appears
  // immediately instead of needing a page refresh to re-fetch it.
  const [recentPulls, setRecentPulls] = useState<GelEntry[]>(initialRecentPulls);
  // "Log a Gel"'s remembered City/Country defaults (SELF flow only) —
  // lifted into state for the same reason: a value just submitted should
  // pre-fill the next time the modal opens in this session, not only after
  // a refresh re-fetches it from the user's stored lastGelCity/lastGelCountry.
  const [lastGelCity, setLastGelCity]       = useState(initialUserLastGelCity);
  const [lastGelCountry, setLastGelCountry] = useState(initialUserLastGelCountry);
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
  const [modalOpen, setModalOpen]                       = useState(false);
  const [preselectedCardOption, setPreselectedCardOption] = useState<ChecklistCardOption | null>(null);
  const [editingGel, setEditingGel]                     = useState<GelEntry | null>(null);
  // Set by a "Claim this card" button (Recent Pulls popup, Logged Gels/
  // Card History popup) — see handleClaimGel below.
  const [claimPrefill, setClaimPrefill]                 = useState<ClaimPrefill | null>(null);
  // Set by "Did you buy/pull this?" (CardImageModal's "..." menu) — see
  // handleCoOwnClaim below.
  const [coOwnPrefill, setCoOwnPrefill]                 = useState<CoOwnPrefill | null>(null);
  // Shown instead of AddGelModal when a signed-out visitor clicks "Add a
  // Gel" — see handleAddGelClick below.
  const [signInRequiredOpen, setSignInRequiredOpen]     = useState(false);

  // ── "X Packs/Boxes Opened" state ────────────────────────────────────────────
  const [packsOpened, setPacksOpened]     = useState<SetPacksOpenedSummary>(initialPacksOpened);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [logOpeningsOpen, setLogOpeningsOpen] = useState(false);

  const handleLogOpeningsSubmit = useCallback(
    async (entries: OpeningEntry[]): Promise<string | void> => {
      const res = await fetch(`/api/sets/${setId}/openings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ entries }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? "Failed to save your openings";

      setPacksOpened(data.summary);
      setLogOpeningsOpen(false);
    },
    [setId]
  );

  // ── Open modal (create) ─────────────────────────────────────────────────────
  // Adding a gel always requires being signed in — a signed-out visitor
  // gets SignInRequiredModal instead of the real Add Gel form. "loading"
  // (the brief window before useSession resolves) is treated as signed-in
  // here rather than flashing the sign-in prompt; the gels API route still
  // rejects the request server-side in that rare race anyway.
  const handleAddGelClick = useCallback(
    (option?: ChecklistCardOption) => {
      if (sessionStatus === "unauthenticated") {
        setSignInRequiredOpen(true);
        return;
      }
      setEditingGel(null);
      setClaimPrefill(null);
      setCoOwnPrefill(null);
      setPreselectedCardOption(option ?? null);
      setModalOpen(true);
    },
    [sessionStatus]
  );

  // ── Open modal (edit) ───────────────────────────────────────────────────────
  const handleEditGelClick = useCallback((gel: GelEntry) => {
    setEditingGel(gel);
    setClaimPrefill(null);
    setCoOwnPrefill(null);
    setPreselectedCardOption(null);
    setModalOpen(true);
  }, []);

  // ── Open modal ("Claim this card") ──────────────────────────────────────────
  // From the Recent Pulls popup or the Logged Gels/Card History popup —
  // see AddGelModal's claimPrefill prop.
  const handleClaimGel = useCallback(
    (prefill: ClaimPrefill) => {
      if (sessionStatus === "unauthenticated") {
        setSignInRequiredOpen(true);
        return;
      }
      setEditingGel(null);
      setPreselectedCardOption(null);
      setCoOwnPrefill(null);
      setClaimPrefill(prefill);
      setModalOpen(true);
    },
    [sessionStatus]
  );

  // ── Open modal ("Did you buy this?" / "Did you pull this?") ────────────────
  // From CardImageModal's "..." menu — see AddGelModal's coOwnPrefill prop.
  const handleCoOwnClaim = useCallback(
    (prefill: CoOwnPrefill) => {
      if (sessionStatus === "unauthenticated") {
        setSignInRequiredOpen(true);
        return;
      }
      setEditingGel(null);
      setPreselectedCardOption(null);
      setClaimPrefill(null);
      setCoOwnPrefill(prefill);
      setModalOpen(true);
    },
    [sessionStatus]
  );

  // ── Close modal ────────────────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    setModalOpen(false);
    setPreselectedCardOption(null);
    setEditingGel(null);
    setClaimPrefill(null);
    setCoOwnPrefill(null);
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
      // `editingGel` (this component's own state, set when the modal was
      // opened for an edit) is still the pre-close value here — handleSubmit
      // calls onSuccess before the modal closes and resets it.
      const isCreate = editingGel === null;
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

      // "Recent Pulls" is a live feed across every user, both own gels and
      // "someone else's gel" reports (see lib/data/sets.ts) — a freshly
      // created gel is, by definition, now the most recent, so it goes
      // straight to the front rather than waiting for a refresh to re-fetch
      // it. An edit doesn't change a gel's original createdAt, so it
      // wouldn't actually move on a real re-fetch — skipped here too.
      if (isCreate) {
        setRecentPulls((prev) => [
          {
            ...gel,
            loggedByName:   session?.user?.name ?? session?.user?.handle ?? "You",
            loggedByHandle: session?.user?.handle ?? null,
          },
          ...prev,
        ].slice(0, RECENT_PULLS_LIMIT));
      } else {
        // Editing a gel that's still visible in "Recent Pulls" (its own
        // "someone else's gel" sighting, edited from there — see
        // RecentPulls.tsx) should update in place rather than go stale
        // until the next refresh. loggedByName/Handle aren't part of the
        // edit response, so carry over whatever was already shown.
        setRecentPulls((prev) =>
          prev.map((g) =>
            g.id === gel.id
              ? { ...gel, loggedByName: g.loggedByName, loggedByHandle: g.loggedByHandle }
              : g
          )
        );
      }

      // "Log a Gel"'s remembered City/Country defaults — only "my own gel"
      // submissions count, and only when a value was actually provided
      // (mirrors rememberGelLocationDefaults' server-side rule so a blank
      // field here never erases a previously remembered default).
      if (!isSurfaced) {
        if (gel.hitCity)    setLastGelCity(gel.hitCity);
        if (gel.hitCountry) setLastGelCountry(gel.hitCountry);
      }
    },
    [editingGel, session]
  );

  // ── Delete a gel ─────────────────────────────────────────────────────────────
  const handleDeleteGel = useCallback(
    async (gelId: string) => {
      const res = await fetch(`/api/sets/${setId}/gels/${gelId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete gel");
      }
      // A gel counts toward "Chases Pulled" if it's owned outright, or if
      // it's a "someone else's gel" sighting the developer has already
      // verified (see chasesPulledInSet's definition in lib/data/sets.ts)
      // — look it up in whichever list the delete came from ("Your Gels"
      // or "Recent Pulls", the only two places this can be triggered from)
      // before removing it, so an unverified sighting's delete doesn't
      // decrement a total it was never counted toward.
      const target = gels.find((g) => g.id === gelId) ?? recentPulls.find((g) => g.id === gelId);
      const wasCounted = target ? target.isInHand !== false || target.isVerified === true : false;

      setGels((prev) => prev.filter((g) => g.id !== gelId));
      setRecentPulls((prev) => prev.filter((g) => g.id !== gelId));
      if (wasCounted) {
        setChasesPulled((prev) => Math.max(0, prev - 1));
      }
    },
    [setId, gels, recentPulls]
  );

  // ── "Your Gels" display picks — one endpoint replaces the whole
  // selection+order in a single call, so add/remove/reorder in the
  // "Manage Display" modal all funnel through here. ─────────────────────────
  const handleSetYourGelsPins = useCallback(
    async (orderedPortfolioCardIds: string[]) => {
      setYourGelsPinnedIds(orderedPortfolioCardIds); // optimistic
      const res = await fetch(`/api/sets/${setId}/your-gels-pins`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ orderedPortfolioCardIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setYourGelsPinnedIds(data.pinnedIds);
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
        // TCG sets filter this dropdown by rarity (cardTier) instead of
        // type (cardCategory) — see ChecklistTable's typeColumnLabel for
        // the matching display-side decision.
        if (filters.filterType)  params.set(category === "TCG" ? "tier" : "type", filters.filterType);
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
    [setId, category]
  );

  // ── Derived stats ──────────────────────────────────────────────────────────
  const userGelCount = gels.length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── 1. Set Header ─────────────────────────────────────────── */}
        <SetHeader
          setName={setName}
          category={category}
          sport={subCategory}
          year={year}
          manufacturer={brand}
          totalPrintRunInSet={totalPrintRunInSet}
          totalCardsInSet={totalCardsInSet}
          totalChaseCardsInSet={totalChaseCardsInSet}
          userGelCount={userGelCount}
          chasesPulled={chasesPulled}
          setImageUrl={imageUrl}
          packsOpenedValue={packsOpened.totalPacksOpened}
          packsOpenedLabel={packsOpened.label}
          onOpenBreakdown={() => setBreakdownOpen(true)}
          onOpenLogOpenings={() => setLogOpeningsOpen(true)}
        />

        {/* ── Recent Pulls (all users, above Your Gels) ──────────────── */}
        <RecentPulls
          gels={recentPulls}
          onClaimGel={handleClaimGel}
          onCoOwnClaim={handleCoOwnClaim}
          onEditGel={handleEditGelClick}
          onDeleteGel={handleDeleteGel}
        />

        {/* ── 2. Your Gels ──────────────────────────────────────────── */}
        {/* pt-6 (padding, not margin) so this adds to — rather than
            competes on the same property with and gets silently
            overridden by — the page's own space-y-8 margin-top. Without
            this, "+ Add Gel" read as a continuation of the Recent Pulls
            grid above it instead of its own section. */}
        <div className="pt-6">
          <YourGels
            gels={displayedYourGels}
            allGels={gels}
            pinnedIds={yourGelsPinnedIds}
            maxDisplay={YOUR_GELS_DISPLAY_LIMIT}
            setId={setId}
            onAddGelClick={() => handleAddGelClick()}
            onEditGel={handleEditGelClick}
            onDeleteGel={handleDeleteGel}
            onSetPinnedIds={handleSetYourGelsPins}
          />
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div className="h-px w-full bg-slate-800/60" />

        {/* ── 3. Full Checklist ─────────────────────────────────────── */}
        <ChecklistTable
          rows={rows}
          meta={meta}
          setId={setId}
          category={category}
          onAddGelClick={handleAddGelClick}
          onClaimGel={handleClaimGel}
          onCoOwnClaim={handleCoOwnClaim}
          onFilterChange={handleFilterChange}
          isLoading={checklistLoading}
          availableTeams={availableTeams}
          availableCategories={availableCategories}   // ✅ NEW
          availableTiers={availableTiers}
        />
      </div>

      {/* ── 4. Add Gel Modal ──────────────────────────────────────────── */}
      <AddGelModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleGelSuccess}
        setId={setId}
        category={category}
        setYear={year}
        products={products}
        preselectedCardOption={preselectedCardOption}
        editingGel={editingGel}
        claimPrefill={claimPrefill}
        coOwnPrefill={coOwnPrefill}
        defaultHitCity={lastGelCity}
        defaultHitCountry={lastGelCountry}
      />

      {/* ── 5. Packs Opened: breakdown + log-your-openings modals ──────── */}
      <PacksOpenedBreakdownModal
        isOpen={breakdownOpen}
        onClose={() => setBreakdownOpen(false)}
        summary={packsOpened}
      />
      <LogProductOpeningsModal
        isOpen={logOpeningsOpen}
        onClose={() => setLogOpeningsOpen(false)}
        products={packsOpened.products}
        onSubmit={handleLogOpeningsSubmit}
      />

      {/* ── 6. Sign-in required (signed-out visitor clicked Add a Gel) ──── */}
      <SignInRequiredModal
        isOpen={signInRequiredOpen}
        onClose={() => setSignInRequiredOpen(false)}
        callbackUrl={`/sets/${setId}`}
      />
    </div>
  );
}
