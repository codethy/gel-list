// app/categories/[category]/[subcategory]/page.tsx
//
// "See all" destination for one subcategory section on a
// /categories/[category] page — the full, infinite-scrolling list of every
// set in that subcategory. See components/SetBrowseGrid.tsx.

import Link from "next/link";
import { notFound } from "next/navigation";
import { slugToCategory, slugToSubCategory, categoryToSlug } from "@/lib/taxonomy";
import SetBrowseGrid from "@/components/SetBrowseGrid";

interface PageProps {
  params: Promise<{ category: string; subcategory: string }>;
}

export default async function SubCategoryPage({ params }: PageProps) {
  const { category: categorySlug, subcategory: subCategorySlug } = await params;
  const parent = slugToCategory(categorySlug);
  if (!parent) notFound();

  const child = slugToSubCategory(parent.enumValue, subCategorySlug);
  if (!child) notFound();

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <Link href={`/categories/${categoryToSlug(parent.enumValue)}`} className="text-sm text-zinc-500 hover:text-white transition-colors">
          &larr; {parent.label}
        </Link>
        <h1 className="text-3xl font-black text-white tracking-tight mt-2 mb-8">
          {child.label}
        </h1>

        <SetBrowseGrid
          subCategoryId={child.id}
          emptyMessage="No sets yet — more will be added here in the future."
        />
      </div>
    </div>
  );
}
