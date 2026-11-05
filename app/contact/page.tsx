// app/contact/page.tsx
//
// Static "Contact Us" page — reached via the Sidebar's "Contact Us" link
// (components/Sidebar.tsx). Shares its Instagram/Facebook icons with the
// Sidebar via components/SocialIcons.tsx.

import Link from "next/link";
import { InstagramIcon, FacebookIcon, INSTAGRAM_URL, FACEBOOK_URL } from "@/components/SocialIcons";

const SUPPORT_EMAIL = "support@gelcards.com";
const REPORT_EMAIL  = "report@gelcards.com";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">

        <div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors w-fit mb-4"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold text-white">Contact Us</h1>
          <p className="text-sm text-slate-400 mt-1">We&apos;d love to hear from you.</p>
        </div>

        {/* ── Find us on social media ────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Find us on social media
          </h2>
          <div className="flex items-center gap-3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Gel Cards on Instagram"
              title="Gel Cards on Instagram"
              className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700 hover:border-slate-500/60 flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150"
            >
              <InstagramIcon className="w-5 h-5" />
            </a>
            <a
              href={FACEBOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Gel Cards on Facebook"
              title="Gel Cards on Facebook"
              className="w-12 h-12 rounded-full bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700 hover:border-slate-500/60 flex items-center justify-center text-slate-300 hover:text-white transition-colors duration-150"
            >
              <FacebookIcon className="w-5 h-5" />
            </a>
          </div>
        </section>

        {/* ── Email ──────────────────────────────────────────────────── */}
        {/* id="email" + scroll-mt-20 — "Report this gel" (CardImageModal's
            "..." menu, see ChecklistTable.tsx) links straight here, offset
            so the sticky Navbar doesn't cover the heading on landing. */}
        <section id="email" className="space-y-2 scroll-mt-20">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            Email
          </h2>
          <p className="text-sm text-slate-300">
            For support:{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors">
              {SUPPORT_EMAIL}
            </a>
          </p>
          <p className="text-sm text-slate-300">
            For reporting cards:{" "}
            <a href={`mailto:${REPORT_EMAIL}`} className="text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors">
              {REPORT_EMAIL}
            </a>
          </p>
        </section>

      </div>
    </div>
  );
}
