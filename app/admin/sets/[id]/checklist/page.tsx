// app/admin/sets/[id]/checklist/page.tsx
//
// Developer-only checklist correction tool for one set — add, edit, or
// delete individual ChecklistCard rows after the set has already been
// imported. Access is granted by hand via prisma/make-admin.ts.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminUserId } from "@/lib/admin";
import {
  getAdminChecklistForSet,
  VALID_CARD_CATEGORIES,
  VALID_CARD_TIERS,
} from "@/lib/data/adminChecklist";
import AdminSetHeader from "@/components/admin/AdminSetHeader";
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
        <Link href="/admin" className="text-sm text-slate-400 hover:text-white transition-colors">
          &larr; Admin
        </Link>
        <div className="mt-2">
          <AdminSetHeader set={detail.set} cardCount={detail.cardsPage.meta.total} />
        </div>
        <AdminChecklistClient
          setId={detail.set.id}
          category={detail.set.category}
          initialCards={detail.cardsPage.cards}
          initialMeta={detail.cardsPage.meta}
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
