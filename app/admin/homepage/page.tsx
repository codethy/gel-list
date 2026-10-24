// app/admin/homepage/page.tsx
//
// Lets the admin choose which sets are featured on the home page, per
// category, and reorder them. See components/admin/AdminHomepageClient.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import AdminHomepageClient from "@/components/admin/AdminHomepageClient";

export default async function AdminHomepagePage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">Home Page Sets</h1>
        <p className="text-sm text-slate-400 mb-8">
          Choose which sets are featured on the home page for each category, and reorder them.
        </p>

        <AdminHomepageClient />
      </div>
    </div>
  );
}
