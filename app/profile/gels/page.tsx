// app/profile/gels/page.tsx
//
// "All Your Gels" — every gel the user owns, across every set, 6 per row
// on larger screens (matching the Your Gels / Favorite Gels grid).

import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getAllUserGels } from "@/lib/data/profile";
import AllGelsGrid from "@/components/profile/AllGelsGrid";

interface AllGelsPageProps {
  // "See All Your Gels" from a set's own "Your Gels" section (see
  // components/set-detail/YourGels.tsx) links here with ?setId= to narrow
  // this down to just that set.
  searchParams: Promise<{ setId?: string }>;
}

export default async function AllGelsPage({ searchParams }: AllGelsPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/profile/gels");
  }

  const { setId } = await searchParams;
  const gels = await getAllUserGels(session.user.id, setId);
  const setName = setId ? gels[0]?.setName : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/profile"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700/50 text-sm text-slate-300 hover:bg-slate-800/60 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {setId ? "Your Gels" : "All Your Gels"}
            </h1>
            <p className="text-sm text-slate-400">
              {setId
                ? `${gels.length} gel${gels.length === 1 ? "" : "s"} logged${setName ? ` in ${setName}` : ""}`
                : `${gels.length} gel${gels.length === 1 ? "" : "s"} logged across every set`}
            </p>
          </div>
          {setId && (
            <Link
              href="/profile/gels"
              className="ml-auto text-sm font-medium text-blue-400 hover:text-blue-300 hover:underline underline-offset-2 transition-colors duration-150"
            >
              View all sets
            </Link>
          )}
        </div>

        <AllGelsGrid gels={gels} />
      </div>
    </div>
  );
}
