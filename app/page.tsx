"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Sidebar, { TAXONOMY, SidebarFilters } from "@/components/Sidebar";
import { SetCard, SkeletonCard, type SetItem } from "@/components/SetCard";
import SeeAllLink from "@/components/SeeAllLink";
import { categoryToSlug } from "@/lib/taxonomy";

// ─── Category display config ─────────────────────────────────────────────────
const CATEGORY_ORDER = ["SPORTS", "ENTERTAINMENT", "TCG"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  SPORTS:        "Sports",
  ENTERTAINMENT: "Entertainment",
  TCG:           "Trading Card Games",
};

// ─── Category Section ────────────────────────────────────────────────────────
function CategorySection({
  label,
  sets,
  seeAllHref,
}: {
  label:      string;
  sets:       SetItem[];
  seeAllHref?: string;
}) {
  if (sets.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white tracking-tight">
          {label}
        </h2>
        {seeAllHref && <SeeAllLink href={seeAllHref} />}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sets.map((set) => (
          <SetCard key={set.id} set={set} />
        ))}
      </div>
    </section>
  );
}

// ─── Initial Skeleton Layout ─────────────────────────────────────────────────
function SkeletonLayout() {
  return (
    <div className="flex flex-col gap-10">
      {["Sports", "Entertainment", "Trading Card Games"].map((label) => (
        <section key={label}>
          <div className="h-5 w-40 bg-[#1e1e1e] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Build API URL ────────────────────────────────────────────────────────────
function buildApiUrl(
  filters: SidebarFilters,
  cursor?: string,
  search?: string,
): string {
  const params = new URLSearchParams();

  if (filters.subcategories.size > 0) {
    params.set("subcategories", [...filters.subcategories].join(","));
  }
  if (filters.years.size > 0) {
    params.set("years", [...filters.years].join(","));
  }
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (search?.trim()) {
    params.set("search", search.trim());
  }

  return `/api/sets?${params.toString()}`;
}

// ─── Group sets by category ───────────────────────────────────────────────────
function groupByCategory(sets: SetItem[]): Record<string, SetItem[]> {
  return sets.reduce<Record<string, SetItem[]>>((acc, set) => {
    const key = set.category ?? "OTHER";
    if (!acc[key]) acc[key] = [];
    acc[key].push(set);
    return acc;
  }, {});
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function HomeContent() {
  const searchParams = useSearchParams();
  // Set via the Navbar's search bar (pressing Enter navigates to
  // /?search=...) — reusing the same filterable grid "Filter" already uses,
  // rather than a separate search-results view.
  const searchQuery = searchParams.get("search") ?? "";

  const [filters, setFilters] = useState<SidebarFilters>({
    subcategories: new Set<string>(),
    years:         new Set<number>(),
  });

  // No filter/search active — the default landing view, showing each
  // category's admin-curated "featured" sets (see /admin/homepage) instead
  // of browsing every set. Filtering or searching falls back to the full,
  // infinite-scrolling browse experience below.
  const isCurated = filters.subcategories.size === 0 && filters.years.size === 0 && !searchQuery;

  const [sets,        setSets]        = useState<SetItem[]>([]);
  const [cursor,      setCursor]      = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Curated fetch (default landing view) ─────────────────────────────────
  const fetchFeatured = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sets/featured");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json() as { grouped: Record<string, SetItem[]> };
      setSets(CATEGORY_ORDER.flatMap((catId) => data.grouped[catId] ?? []));
      setHasMore(false);
    } catch (err) {
      console.error("[HomePage] Failed to load featured sets:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Core fetch function (filtered/search browse) ─────────────────────────
  const fetchSets = useCallback(async (
    currentFilters: SidebarFilters,
    currentCursor:  string | null,
    isReset:        boolean,
  ) => {
    if (isReset) {
      setLoading(true);
      setSets([]);
      setCursor(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const url  = buildApiUrl(currentFilters, currentCursor ?? undefined, searchQuery);
      const res  = await fetch(url);

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json() as {
        sets:       SetItem[];
        nextCursor: string | null;
      };

      setSets((prev) => isReset ? data.sets : [...prev, ...data.sets]);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);

    } catch (err) {
      console.error("[HomePage] Failed to load sets:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery]);

  // ── Re-fetch whenever filters or the search query change ────────────────
  useEffect(() => {
    if (isCurated) {
      fetchFeatured();
    } else {
      fetchSets(filters, null, true);
    }
  }, [filters, searchQuery, isCurated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── IntersectionObserver (filtered/search browse only — the curated view
  //    has nothing more to load) ────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || isCurated) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchSets(filters, cursor, false);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, cursor, filters, fetchSets, isCurated]);

  const visibleCategories =
    filters.subcategories.size > 0
      ? CATEGORY_ORDER.filter((catId) => {
          const parent = TAXONOMY.find((t) => t.enumValue === catId);
          return parent?.children.some((c) => filters.subcategories.has(c.id));
        })
      : [...CATEGORY_ORDER];

  const grouped = groupByCategory(sets);
  const isEmpty = !loading && sets.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">

      {/* ── Sidebar ── */}
      <Sidebar filters={filters} onChange={setFilters} />

      {/* ── Main Content ── */}
      <main className="flex-1 px-8 py-8 overflow-y-auto">

        <div className="mb-8">
          <h1 className="text-3xl font-black text-white tracking-tight">
            Browse Sets
          </h1>
          {searchQuery ? (
            <p className="text-zinc-500 text-sm mt-1">
              Results for &quot;{searchQuery}&quot;
              {!loading && ` — ${sets.length}${hasMore ? "+" : ""} found`}
              {" · "}
              <Link href="/" className="text-zinc-400 hover:text-white underline underline-offset-2">
                Clear
              </Link>
            </p>
          ) : (
            !loading && !isEmpty && !isCurated && (
              <p className="text-zinc-500 text-sm mt-1">
                {sets.length} set{sets.length !== 1 ? "s" : ""}
                {hasMore ? "+" : ""} loaded
              </p>
            )
          )}
        </div>

        {loading && sets.length === 0 && <SkeletonLayout />}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1a1a1a] flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-zinc-600"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="text-zinc-500 text-sm">
              No sets found — try adjusting your filters
            </p>
          </div>
        )}

        {!loading && sets.length > 0 && (
          <div className="flex flex-col">
            {visibleCategories.map((catId) => (
              <CategorySection
                key={catId}
                label={CATEGORY_LABELS[catId] ?? catId}
                sets={grouped[catId] ?? []}
                seeAllHref={isCurated ? `/categories/${categoryToSlug(catId)}` : undefined}
              />
            ))}

            {Object.entries(grouped)
              .filter(([catId]) => !(CATEGORY_ORDER as readonly string[]).includes(catId))
              .map(([catId, catSets]) => (
                <CategorySection
                  key={catId}
                  label={CATEGORY_LABELS[catId] ?? catId}
                  sets={catSets}
                />
              ))}
          </div>
        )}

        {loadingMore && (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={`more-skel-${i}`} />
            ))}
          </div>
        )}

        <div ref={sentinelRef} className="h-4" />

      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
