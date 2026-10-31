// app/admin/duplicate-gels/page.tsx
//
// Developer-only review queue for filed duplicate-gel cases — see
// lib/data/adminDuplicateGels.ts and prisma/schema.prisma's
// DuplicateGelFile. Access is granted by hand via prisma/make-admin.ts.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUserId } from "@/lib/admin";
import { getAllDuplicateFiles } from "@/lib/data/adminDuplicateGels";
import AdminDuplicateGelsClient from "@/components/admin/AdminDuplicateGelsClient";

export default async function AdminDuplicateGelsPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const files = await getAllDuplicateFiles();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-3 mb-1">Duplicate Gel Files</h1>
        <p className="text-sm text-slate-400 mb-8">
          Cases where two users logged the same serialized card — review, confirm, or dismiss.
        </p>

        <AdminDuplicateGelsClient initialFiles={files} />
      </div>
    </div>
  );
}
