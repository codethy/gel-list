// app/admin/sets/[id]/checklist/page.tsx
//
// Developer-only checklist correction tool for one set — add, edit, or
// delete individual ChecklistCard rows after the set has already been
// imported. Access is granted by hand via prisma/make-admin.ts.

import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import {
  getAdminChecklistForSet,
  VALID_CARD_CATEGORIES,
  VALID_CARD_TIERS,
} from "@/lib/data/adminChecklist";
import AdminChecklistClient from "@/components/admin/AdminChecklistClient";
import AdminProductsClient from "@/components/admin/AdminProductsClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminSetChecklistPage({ params }: PageProps) {
  const adminUserId = await getAdminUserId();
  if (!adminUserId) notFound();

  const { id } = await params;
  const detail = await getAdminChecklistForSet(id);
  if (!detail) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">{detail.set.name}</h1>
        <p className="text-sm text-slate-400 mb-8">
          {detail.set.year} &bull; {detail.set.brand} &bull; {detail.cards.length.toLocaleString()} cards.
          Add, edit, or delete checklist rows to fix import mistakes.
        </p>
        <AdminChecklistClient
          setId={detail.set.id}
          category={detail.set.category}
          initialCards={detail.cards}
          cardCategoryOptions={VALID_CARD_CATEGORIES}
          cardTierOptions={VALID_CARD_TIERS}
        />
        <AdminProductsClient
          setId={detail.set.id}
          initialProducts={detail.products}
        />
      </div>
    </div>
  );
}
