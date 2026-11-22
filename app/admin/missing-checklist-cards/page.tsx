// app/admin/missing-checklist-cards/page.tsx
//
// Developer-only backlog of cards known to exist but not yet added to a
// set's checklist. Access is granted by hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import { listMissingChecklistCards } from "@/lib/data/missingChecklistCards";
import AdminMissingChecklistCardsClient from "@/components/admin/AdminMissingChecklistCardsClient";

export default async function AdminMissingChecklistCardsPage() {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const cards = await listMissingChecklistCards("MISSING");

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <h1 className="text-2xl font-bold text-white mt-2 mb-1">Cards Missing From Checklist</h1>
        <p className="text-sm text-slate-400 mb-8">
          Cards confirmed to exist but not yet added to their set&apos;s checklist — a backlog for later data entry.
        </p>
        <AdminMissingChecklistCardsClient initialCards={cards} />
      </div>
    </div>
  );
}
