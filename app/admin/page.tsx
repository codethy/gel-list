// app/admin/page.tsx
//
// Developer-only admin home. Access is granted by hand via
// prisma/make-admin.ts — there's no in-app way to reach this otherwise.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getAdminChecklistSets, type AdminChecklistSet } from "@/lib/data/adminChecklist";
import { TAXONOMY } from "@/lib/taxonomy";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const sets = await getAdminChecklistSets();

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
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-4 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Gel Review Queue</p>
          <p className="text-sm text-slate-400">Verify, reject, edit, or delete logged gels across every set.</p>
        </Link>

        <Link
          href="/admin/homepage"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-8 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Home Page Sets</p>
          <p className="text-sm text-slate-400">Choose and reorder which sets are featured on the home page, per category.</p>
        </Link>

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Edit a set&apos;s checklist
        </h2>

        {byCategory.length === 0 && (
          <p className="text-sm text-slate-500">No sets yet.</p>
        )}

        <div className="flex flex-col gap-8">
          {byCategory.map((cat) => (
            <div key={cat.label}>
              <h3 className="text-base font-bold text-white mb-3">{cat.label}</h3>
              <div className="flex flex-col gap-5">
                {cat.subcategories.map((sub) => (
                  <div key={sub.label}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {sub.label}
                    </p>
                    <div className="flex flex-col gap-2">
                      {sub.sets.map((s) => (
                        <SetLink key={s.id} set={s} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SetLink({ set }: { set: AdminChecklistSet }) {
  return (
    <Link
      href={`/admin/sets/${set.id}/checklist`}
      className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-3 hover:border-slate-500 transition-colors"
    >
      <div>
        <p className="font-medium text-white">{set.name}</p>
        <p className="text-xs text-slate-500">{set.year} &bull; {set.brand}</p>
      </div>
      <span className="text-sm text-slate-400 tabular-nums">{set.cardCount.toLocaleString()} cards</span>
    </Link>
  );
}
