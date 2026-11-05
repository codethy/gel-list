// lib/data/aboutUs.ts
//
// Data layer for the About Us page's admin-editable header+copy blocks —
// see app/about/page.tsx (public render) and
// components/admin/AdminAboutClient.tsx (the editor). The page's title and
// closing tagline are fixed in the page template, not stored here.

import { prisma } from "@/lib/prisma";

export interface AboutUsSection {
  id:      string;
  heading: string | null;
  body:    string;
  order:   number;
}

const sectionSelect = { id: true, heading: true, body: true, order: true } as const;

export async function getAboutUsSections(): Promise<AboutUsSection[]> {
  return prisma.aboutUsSection.findMany({
    orderBy: { order: "asc" },
    select:  sectionSelect,
  });
}

export async function createAboutUsSection(heading: string | null, body: string): Promise<AboutUsSection> {
  const last = await prisma.aboutUsSection.aggregate({ _max: { order: true } });
  const order = (last._max.order ?? -1) + 1;
  return prisma.aboutUsSection.create({
    data:   { heading, body, order },
    select: sectionSelect,
  });
}

export async function updateAboutUsSection(
  id: string,
  data: { heading?: string | null; body?: string }
): Promise<AboutUsSection> {
  return prisma.aboutUsSection.update({
    where: { id },
    data,
    select: sectionSelect,
  });
}

export async function deleteAboutUsSection(id: string): Promise<void> {
  await prisma.aboutUsSection.delete({ where: { id } });
}

export async function reorderAboutUsSections(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.aboutUsSection.update({ where: { id }, data: { order: index } })
    )
  );
}
