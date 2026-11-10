// app/admin/breaker-profiles/page.tsx
//
// Developer-only breaker profile management — create/edit/remove breaker
// profiles, and view each one's attributed products-opened and gels-hit
// breakdown. Access is granted by hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { listBreakerProfiles } from "@/lib/data/breakerProfiles";
import AdminBreakerProfilesClient from "@/components/admin/AdminBreakerProfilesClient";

export default async function AdminBreakerProfilesPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const profiles = await listBreakerProfiles();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">Breaker Profiles</h1>
        <p className="text-sm text-slate-400 mb-8">
          Track how many boxes each breaker has opened and how many gels they&apos;ve hit, across every set.
        </p>
        <AdminBreakerProfilesClient initialProfiles={profiles} />
      </div>
    </div>
  );
}
