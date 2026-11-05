// app/admin/gels/page.tsx
//
// Developer-only gel review queue. Access is granted by hand via
// prisma/make-admin.ts — there's no in-app way to reach this otherwise.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getReviewQueueGels } from "@/lib/data/adminGels";
import AdminGelsClient from "@/components/admin/AdminGelsClient";

export default async function AdminGelsPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  // Server-rendered first page of the default "Not Verified" tab, no
  // search — everything else (tab switches, search, pagination) is a
  // client-side refetch against GET /api/admin/gels.
  const initialPage = await getReviewQueueGels({ status: "UNVERIFIED", page: 1 });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">Gel Review Queue</h1>
        <p className="text-sm text-slate-400 mb-8">
          Every logged gel across the platform. Not Verified shows the
          longest-waiting submissions first; Verified shows the most recent
          decisions first. Verify or reject pending submissions, or edit/
          delete any entry.
        </p>
        <AdminGelsClient initialPage={initialPage} />
      </div>
    </div>
  );
}
