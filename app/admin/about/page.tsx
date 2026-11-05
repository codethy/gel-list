// app/admin/about/page.tsx
//
// Developer-only editor for the public About Us page (app/about/page.tsx)
// — add, edit, remove, and reorder its header+copy blocks. Access is
// granted by hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getAboutUsSections } from "@/lib/data/aboutUs";
import AdminAboutClient from "@/components/admin/AdminAboutClient";

export default async function AdminAboutPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const sections = await getAboutUsSections();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">About Us</h1>
        <p className="text-sm text-slate-400 mb-8">
          Edit the header+copy blocks shown on the public{" "}
          <Link href="/about" target="_blank" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">
            About Us
          </Link>{" "}
          page. The page title and closing tagline are fixed and not editable here.
        </p>
        <AdminAboutClient initialSections={sections} />
      </div>
    </div>
  );
}
