// app/profile/page.tsx
//
// The signed-in user's profile: an account-info card (left) with a stack of
// 4 stat boxes beside it (right, matched to the card's height), and the
// user's hand-picked "Favorite Gels" — see
// components/profile/ProfileFavorites.tsx for the interactive part.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getProfileStats, getFavoriteGels, getAllUserGels, MAX_FAVORITE_GELS } from "@/lib/data/profile";
import ProfileAccountCard from "@/components/profile/ProfileAccountCard";
import ProfileFavorites from "@/components/profile/ProfileFavorites";

function StatBox({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 px-5 py-4 rounded-xl bg-slate-800/60 border border-slate-700/50 ${className}`}
    >
      <span className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</span>
      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium text-center">
        {label}
      </span>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/profile");
  }

  const userId = session.user.id;

  const [user, stats, favorites, allGels] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { createdAt: true, name: true, handle: true, profileImage: true, email: true },
    }),
    getProfileStats(userId),
    getFavoriteGels(userId),
    getAllUserGels(userId),
  ]);

  const memberSince = user?.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        <h1 className="text-2xl font-bold text-white">Profile</h1>

        {/* ── Account card (left) + stat stack (right, height-matched) ──── */}
        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          {/* Account card — editable avatar, name, and handle. Sign-out
              lives in the Navbar only, so it isn't duplicated here. Sized
              to fill whatever height the stat stack beside it ends up at. */}
          <ProfileAccountCard
            initialName={user?.name ?? session.user.name ?? ""}
            initialHandle={user?.handle ?? session.user.handle ?? null}
            initialProfileImage={user?.profileImage ?? null}
            email={user?.email ?? session.user.email ?? null}
            memberSince={memberSince ?? null}
          />

          <div className="flex flex-col gap-3 w-full sm:w-[240px]">
            <StatBox className="flex-1" label="Sets Opened" value={stats.setsOpened} />
            <StatBox className="flex-1" label="Total Gels" value={stats.totalGels} />
            <StatBox className="flex-1" label="Total Contributions" value={stats.totalContributions} />
            <StatBox className="flex-1" label="Likes Received" value={stats.likesReceived} />
          </div>
        </div>

        {/* ── Favorite Gels ─────────────────────────────────────────────── */}
        <ProfileFavorites
          initialFavorites={favorites}
          allGels={allGels}
          maxFavorites={MAX_FAVORITE_GELS}
        />
      </div>
    </div>
  );
}
