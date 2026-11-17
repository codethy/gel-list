// app/admin/eql-tracker/page.tsx
//
// Developer-only EQL Tracker management — enroll sets, configure their
// options, and edit/remove existing enrollments. Access is granted by
// hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { listEqlSets } from "@/lib/data/eqlTracker";
import AdminEqlTrackerClient from "@/components/admin/AdminEqlTrackerClient";

export default async function AdminEqlTrackerPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const sets = await listEqlSets();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">EQL Tracker</h1>
        <p className="text-sm text-slate-400 mb-8">
          Enroll sets that have an EQL drop and configure their options, max quantities, and estimated print runs.
        </p>
        <AdminEqlTrackerClient initialSets={sets} />
      </div>
    </div>
  );
}
