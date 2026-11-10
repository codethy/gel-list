// app/admin/page.tsx
//
// Developer-only admin home. Access is granted by hand via
// prisma/make-admin.ts — there's no in-app way to reach this otherwise.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getAdminChecklistSets } from "@/lib/data/adminChecklist";
import { getUnverifiedGelCount } from "@/lib/data/adminGels";
import { TAXONOMY } from "@/lib/taxonomy";
import AdminChecklistSetBrowser from "@/components/admin/AdminChecklistSetBrowser";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const [sets, unverifiedCount] = await Promise.all([
    getAdminChecklistSets(),
    getUnverifiedGelCount(),
  ]);

  // Category -> subcategory -> sets, following the same order as the
  // Sidebar's filter list — a category or subcategory with no sets yet is
  // left out entirely, rather than showing an empty section.
  const byCategory = TAXONOMY.map((parent) => ({
    label: parent.label,
    subcategories: parent.children
      .map((child) => ({
        label: child.label,
        sets: sets.filter(
          (s) => s.category === parent.enumValue && s.subCategory.toUpperCase() === child.id
        ),
      }))
      .filter((sub) => sub.sets.length > 0),
  })).filter((cat) => cat.subcategories.length > 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">Admin</h1>
        <p className="text-sm text-slate-400 mb-8">Developer-only tools.</p>

        <Link
          href="/admin/gels"
          className="flex items-center justify-between gap-3 rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <div>
            <p className="font-semibold text-white">Gel Review Queue</p>
            <p className="text-sm text-slate-400">Verify, reject, edit, or delete logged gels across every set.</p>
          </div>
          {unverifiedCount > 0 && (
            <span className="shrink-0 min-w-[1.5rem] h-6 px-1.5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold">
              {unverifiedCount > 99 ? "99+" : unverifiedCount}
            </span>
          )}
        </Link>

        <Link
          href="/admin/duplicate-gels"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Duplicate Gel Files</p>
          <p className="text-sm text-slate-400">Review and resolve cases where two users logged the same serialized card.</p>
        </Link>

        <Link
          href="/admin/homepage"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Home Page Sets</p>
          <p className="text-sm text-slate-400">Choose and reorder which sets are featured on the home page, per category.</p>
        </Link>

        <Link
          href="/admin/about"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">About Us</p>
          <p className="text-sm text-slate-400">Edit the header and copy blocks shown on the public About Us page.</p>
        </Link>

        <Link
          href="/admin/users"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">User Count</p>
          <p className="text-sm text-slate-400">A live counter of how many accounts have been created.</p>
        </Link>

        <Link
          href="/admin/breaker-profiles"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-8 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Breaker Profiles</p>
          <p className="text-sm text-slate-400">Manage breaker profiles and see how many boxes/gels each has attributed.</p>
        </Link>

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Edit a set&apos;s checklist
        </h2>

        {byCategory.length === 0 ? (
          <p className="text-sm text-slate-500">No sets yet.</p>
        ) : (
          <AdminChecklistSetBrowser byCategory={byCategory} />
        )}
      </div>
    </div>
  );
}
