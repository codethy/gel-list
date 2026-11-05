// app/about/page.tsx
//
// Static "About Us" page — reached via the Sidebar's "About Us" link
// (components/Sidebar.tsx). The page title and closing tagline are fixed
// here; the header+copy blocks in between are admin-editable — see
// lib/data/aboutUs.ts and components/admin/AdminAboutClient.tsx.

import Link from "next/link";
import { getAboutUsSections } from "@/lib/data/aboutUs";

// Admin edits (lib/data/aboutUs.ts, via /admin/about) should appear
// immediately — this page has no revalidation hook to invalidate a cached
// render, so it reads fresh from the database on every request instead.
export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const sections = await getAboutUsSections();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12 text-center">

        <div className="flex flex-col items-center">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
          <h1 className="text-4xl font-bold text-white">About Us</h1>
        </div>

        {sections.map((section) => (
          <section key={section.id} className="space-y-3">
            {section.heading && (
              <h2 className="text-xl font-semibold text-white uppercase tracking-wider">
                {section.heading}
              </h2>
            )}
            <p className="text-lg text-white leading-relaxed whitespace-pre-line">
              {section.body}
            </p>
          </section>
        ))}

        <p className="text-2xl font-bold text-white tracking-wide">
          Rip. Gel. Repeat.
        </p>

      </div>
    </div>
  );
}
