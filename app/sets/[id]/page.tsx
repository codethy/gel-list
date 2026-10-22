// app/sets/[id]/page.tsx

import { notFound }         from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions }      from "@/app/api/auth/[...nextauth]/route";
import { getSetDetail }     from "@/lib/data/sets";
import { prisma }           from "@/lib/prisma";
import SetDetailClient      from "@/components/set-detail/SetDetailClient";

interface PageProps {
  // ── FIX: In Next.js 15, params is a Promise — the type must reflect this.
  // The code already correctly uses `await params` below, but without this
  // type annotation TypeScript will report an error on that await expression.
  params: Promise<{ id: string }>;
}

export default async function SetDetailPage({ params }: PageProps) {

  // ── 1. Get the logged-in user's id (null if not logged in) ───────────────
  // We look up by email rather than using session.user.id directly because
  // the session token may not always carry the database id reliably.
  const session = await getServerSession(authOptions);
  let userId: string | null = null;

  if (session?.user?.email) {
    const user = await prisma.user.findUnique({
      where:  { email: session.user.email },
      select: { id: true },
    });
    userId = user?.id ?? null;
  }

  // ── 2. Resolve the set id from the URL ───────────────────────────────────
  // params must be awaited before accessing any property on it in Next.js 15.
  const { id } = await params;

  // ── 3. Fetch all data for this page ──────────────────────────────────────
  // getSetDetail fetches the set metadata, the user's gels, the checklist
  // rows (now including cardNumber, imageUrl, status, and notes), available
  // teams for filtering, and all card templates for the Add Gel modal.
  const data = await getSetDetail(id, userId);

  // ── 4. 404 if the set doesn't exist ──────────────────────────────────────
  if (!data) notFound();

  // ── 5. Pass all data to the client component ──────────────────────────────
  // No changes needed here — SetDetailClient receives the same props as
  // before. The checklist rows now carry the extra fields automatically
  // because getSetDetail and the checklist API route have been updated.
  return (
    <SetDetailClient
      setId={data.setId}
      setName={data.setName}
      category={data.category}
      subCategory={data.subCategory}
      year={data.year}
      brand={data.brand}
      totalPrintRunInSet={data.totalPrintRunInSet}
      totalCardsInSet={data.totalCardsInSet}
      chasesPulledInSet={data.chasesPulledInSet}
      totalChaseCardsInSet={data.totalChaseCardsInSet}
      imageUrl={data.imageUrl}
      initialGels={data.userGels}
      initialRows={data.checklistRows}
      initialMeta={data.checklistMeta}
      availableTeams={data.availableTeams}
      availableCategories={data.availableCategories}
      availableTiers={data.availableTiers}
      allTemplates={data.allTemplates}
      products={data.products}
    />
  );
}
