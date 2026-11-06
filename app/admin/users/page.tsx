// app/admin/users/page.tsx
//
// Developer-only live counter of total accounts created. Access is
// granted by hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { getUserCount } from "@/lib/data/adminUsers";
import AdminUserCountClient from "@/components/admin/AdminUserCountClient";

export default async function AdminUsersPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const initialCount = await getUserCount();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">User Count</h1>
        <p className="text-sm text-slate-400 mb-8">A live counter of how many accounts have been created.</p>
        <AdminUserCountClient initialCount={initialCount} />
      </div>
    </div>
  );
}
