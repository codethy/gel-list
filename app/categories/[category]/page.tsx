// app/categories/[category]/page.tsx
//
// "See all" destination for a home page category section (Sports /
// Entertainment / Trading Card Games). Divided into one section per
// subcategory, in the same order as the Sidebar's filter list — each
// showing up to 10 sets and its own "See all" link through to
// /categories/[category]/[subcategory] for the full list.

import Link from "next/link";
import { notFound } from "next/navigation";
import { slugToCategory, categoryToSlug, subCategoryToSlug } from "@/lib/taxonomy";
import { getCategoryOverviewSections } from "@/lib/data/homepage";
import { SetCard } from "@/components/SetCard";
import SeeAllLink from "@/components/SeeAllLink";

interface PageProps {
  params: Promise<{ category: string }>;
}

export default async function CategoryOverviewPage({ params }: PageProps) {
  const { category: categorySlug } = await params;
  const parent = slugToCategory(categorySlug);
  if (!parent) notFound();

  const sections = await getCategoryOverviewSections(parent.enumValue as "SPORTS" | "ENTERTAINMENT" | "TCG");

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <Link href="/" className="text-sm text-zinc-500 hover:text-white transition-colors">
          &larr; Home
        </Link>
        <h1 className="text-3xl font-black text-white tracking-tight mt-2 mb-8">
          {parent.label}
        </h1>

        <div className="flex flex-col">
          {sections.map((section) => (
            <section key={section.subCategoryId} className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {section.label}
                </h2>
                <SeeAllLink
                  href={`/categories/${categoryToSlug(parent.enumValue)}/${subCategoryToSlug(section.subCategoryId)}`}
                />
              </div>

              {section.sets.length === 0 ? (
                <p className="text-zinc-600 text-sm py-6">
                  No sets yet — more will be added here in the future.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {section.sets.map((set) => (
                    <SetCard key={set.id} set={set} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
