// components/SeeAllLink.tsx
//
// The small "See all" chevron link shown in a section header — home page
// category sections, category-overview subcategory sections. No hooks, so
// it works from both server and client components.

import Link from "next/link";

export default function SeeAllLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-0.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-150 shrink-0"
    >
      See all
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}
