// components/SetCard.tsx
//
// The set "bubble" card used on the home page's curated sections, the
// category/subcategory browse pages, and their loading skeletons. No hooks
// or client-only APIs — just a Link + img — so it works unmodified from
// both server components (the category overview page) and client ones
// (the home page, the subcategory infinite-scroll grid).

import Link from "next/link";
import Image from "next/image";

export interface SetItem {
  id:                 string;
  name:               string;
  category:           string;
  subCategory:        string;
  year:               number;
  imageUrl:           string | null;
  totalPrintRunInSet: number;
  totalCardsInSet:    number;
  totalHitsInSet:     number;
}

export function SkeletonCard() {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-xl p-3 flex flex-col gap-3 animate-pulse">
      <div className="w-full aspect-square bg-[#1e1e1e] rounded-lg" />
      <div className="flex flex-col gap-2">
        <div className="h-3 bg-[#1e1e1e] rounded w-3/4" />
        <div className="h-3 bg-[#1e1e1e] rounded w-1/2" />
      </div>
      <div className="pt-2 border-t border-[#1e1e1e] flex justify-between">
        <div className="h-2.5 bg-[#1e1e1e] rounded w-16" />
        <div className="h-2.5 bg-[#1e1e1e] rounded w-10" />
      </div>
    </div>
  );
}

export function SetCard({ set }: { set: SetItem }) {
  return (
    <Link
      href={`/sets/${set.id}`}
      className="bg-[#111111] border border-[#222222] rounded-xl p-3 flex flex-col gap-3 hover:border-zinc-600 hover:bg-[#161616] transition-all duration-200 cursor-pointer group"
    >
      {/* Image */}
      <div className="relative w-full aspect-square bg-[#1a1a1a] rounded-lg flex items-center justify-center border border-[#2a2a2a] group-hover:border-zinc-600 transition-colors overflow-hidden">
        {set.imageUrl ? (
          <Image
            src={set.imageUrl}
            alt={set.name}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 180px"
            className="object-contain"
          />
        ) : (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            className="text-zinc-700"
          >
            <rect x="2" y="3" width="14" height="20" rx="2" />
            <path d="M8 21h8a2 2 0 002-2V7l-5-5H8a2 2 0 00-2 2" />
          </svg>
        )}
      </div>

      {/* Name + meta */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-white leading-tight line-clamp-2">
          {set.name}
        </h3>
        <p className="text-xs text-zinc-500">
          {set.subCategory.replace(/_/g, " ").toUpperCase()} · {set.year}
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-[#1e1e1e]">
        <span className="text-[11px] text-zinc-500">
          {/* TCG has no reliable print run to sum/estimate, so it shows a
              plain chase-card count instead — see SetHeader.tsx. */}
          {set.category === "TCG"
            ? `${set.totalCardsInSet.toLocaleString()} chase cards`
            : `${set.totalPrintRunInSet.toLocaleString()} chase cards`}
        </span>
        {set.totalHitsInSet > 0 && (
          <span className="text-[11px] text-yellow-500/80 font-medium">
            {set.totalHitsInSet} hits
          </span>
        )}
      </div>
    </Link>
  );
}
