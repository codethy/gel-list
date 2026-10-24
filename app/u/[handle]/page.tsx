// app/u/[handle]/page.tsx
//
// A public, read-only view of another user's profile — reached by clicking
// their @handle (e.g. the "logged by" tag on a Recent Pulls card). Same
// layout as /profile, minus email and every edit control (see the
// `editable={false}` props below) — see ProfileAccountCard.tsx and
// ProfileFavorites.tsx for what that actually hides.
//
// If the viewer is signed in and this handle is their own, they're sent to
// their private /profile instead (same data, but editable).

import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserByHandle, getProfileStats, getFavoriteGels, MAX_FAVORITE_GELS } from "@/lib/data/profile";
import ProfileAccountCard from "@/components/profile/ProfileAccountCard";
import ProfileFavorites from "@/components/profile/ProfileFavorites";
import StatBox from "@/components/profile/StatBox";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { handle } = await params;

  const session = await getServerSession(authOptions);
  if (session?.user?.handle && session.user.handle === handle) {
    redirect("/profile");
  }

  const user = await getUserByHandle(handle);
  if (!user) notFound();

  const [stats, favorites] = await Promise.all([
    getProfileStats(user.id),
    getFavoriteGels(user.id),
  ]);

  const memberSince = user.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        <h1 className="text-2xl font-bold text-white">Profile</h1>

        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          <ProfileAccountCard
            initialName={user.name}
            initialHandle={user.handle}
            initialProfileImage={user.profileImage}
            email={null}
            memberSince={memberSince}
            editable={false}
          />

          <div className="flex flex-col gap-3 w-full sm:w-[240px]">
            <StatBox className="flex-1" label="Sets Opened" value={stats.setsOpened} />
            <StatBox className="flex-1" label="Total Gels" value={stats.totalGels} />
            <StatBox className="flex-1" label="Total Contributions" value={stats.totalContributions} />
            <StatBox className="flex-1" label="Likes Received" value={stats.likesReceived} />
          </div>
        </div>

        <ProfileFavorites
          initialFavorites={favorites}
          allGels={[]}
          maxFavorites={MAX_FAVORITE_GELS}
          editable={false}
        />
      </div>
    </div>
  );
}
