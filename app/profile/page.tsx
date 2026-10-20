// app/profile/page.tsx
//
// The signed-in user's profile: a compact account-info card (top right),
// a few collection stats, and their hand-picked "Favorite Gels" — see
// components/profile/ProfileFavorites.tsx for the interactive part.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getProfileStats, getFavoriteGels, getAllUserGels, MAX_FAVORITE_GELS } from "@/lib/data/profile";
import ProfileSignOutButton from "@/components/ProfileSignOutButton";
import ProfileFavorites from "@/components/profile/ProfileFavorites";

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-1 px-5 py-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
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
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
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

        {/* ── Header row: title + compact account card (upper right) ──── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <h1 className="text-2xl font-bold text-white">Profile</h1>

          {/* Account card — ~35% smaller than the original full-page card,
              moved from page-center to here. Restyled to match the rest of
              the app's slate theme rather than the sign-in page's stark
              black/white look, since this page now has real content around it. */}
          <div className="w-[272px] shrink-0 rounded-xl border border-slate-700/50 bg-slate-800/60 px-5 py-4 flex flex-col items-center gap-3">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-[52px] h-[52px] rounded-full border border-slate-600/50"
              />
            ) : (
              <div className="w-[52px] h-[52px] rounded-full bg-slate-700 border border-slate-600/50" />
            )}

            <div className="flex flex-col items-center gap-0.5 text-center">
              <p className="text-sm font-bold text-white">{session.user.name}</p>
              {session.user.handle && (
                <p className="text-xs text-slate-500">@{session.user.handle}</p>
              )}
            </div>

            <div className="w-full h-px bg-slate-700/50" />

            <div className="w-full flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500 shrink-0">Email</span>
                <span className="text-slate-300 truncate">{session.user.email}</span>
              </div>
              {memberSince && (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 shrink-0">Member since</span>
                  <span className="text-slate-300">{memberSince}</span>
                </div>
              )}
            </div>

            <ProfileSignOutButton />
          </div>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 max-w-xl">
          <StatBox label="Sets Opened" value={stats.setsOpened} />
          <StatBox label="Total Gels" value={stats.totalGels} />
          <StatBox label="Total Contributions" value={stats.totalContributions} />
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
