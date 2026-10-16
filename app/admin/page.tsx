// app/admin/page.tsx
//
// Developer-only admin home. Access is granted by hand via
// prisma/make-admin.ts — there's no in-app way to reach this otherwise.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getAdminChecklistSets } from "@/lib/data/adminChecklist";

export default async function AdminHomePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const sets = await getAdminChecklistSets();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">Admin</h1>
        <p className="text-sm text-slate-400 mb-8">Developer-only tools.</p>

        <Link
          href="/admin/gels"
          className="block rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-4 mb-8 hover:border-slate-500 transition-colors"
        >
          <p className="font-semibold text-white">Gel Review Queue</p>
          <p className="text-sm text-slate-400">Verify, reject, edit, or delete logged gels across every set.</p>
        </Link>

        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Edit a set&apos;s checklist
        </h2>
        <div className="flex flex-col gap-2">
          {sets.map((s) => (
            <Link
              key={s.id}
              href={`/admin/sets/${s.id}/checklist`}
              className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/50 px-5 py-3 hover:border-slate-500 transition-colors"
            >
              <div>
                <p className="font-medium text-white">{s.name}</p>
                <p className="text-xs text-slate-500">{s.year} &bull; {s.brand}</p>
              </div>
              <span className="text-sm text-slate-400 tabular-nums">{s.cardCount.toLocaleString()} cards</span>
            </Link>
          ))}
          {sets.length === 0 && (
            <p className="text-sm text-slate-500">No sets yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
