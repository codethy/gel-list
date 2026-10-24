// components/SetBrowseGrid.tsx
//
// Infinite-scrolling grid of every set in one fixed subcategory — the
// "See all" destination for a subcategory section on a
// /categories/[category] page. Same fetch-more-on-scroll mechanics as the
// home page's filtered browse view, just scoped to a single subcategory
// with no Sidebar/search UI.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SetCard, SkeletonCard, type SetItem } from "@/components/SetCard";

const PAGE_LIMIT = 18;

interface SetBrowseGridProps {
  subCategoryId: string;
  emptyMessage:  string;
}

export default function SetBrowseGrid({ subCategoryId, emptyMessage }: SetBrowseGridProps) {
  const [sets,        setSets]        = useState<SetItem[]>([]);
  const [cursor,      setCursor]      = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(async (currentCursor: string | null, isReset: boolean) => {
    if (isReset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ subcategories: subCategoryId, limit: String(PAGE_LIMIT) });
      if (currentCursor) params.set("cursor", currentCursor);

      const res = await fetch(`/api/sets?${params.toString()}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json() as { sets: SetItem[]; nextCursor: string | null };
      setSets((prev) => isReset ? data.sets : [...prev, ...data.sets]);
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
    } catch (err) {
      console.error("[SetBrowseGrid] Failed to load sets:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [subCategoryId]);

  useEffect(() => {
    fetchPage(null, true);
  }, [fetchPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPage(cursor, false);
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, cursor, fetchPage]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (sets.length === 0) {
    return <p className="text-zinc-600 text-sm py-10">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {sets.map((set) => <SetCard key={set.id} set={set} />)}
      </div>

      {loadingMore && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`more-${i}`} />)}
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
    </>
  );
}
