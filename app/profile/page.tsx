// app/profile/page.tsx
//
// Minimal profile page — the Navbar has always linked here (next to the
// user's name), but until now there was nothing to land on. Shows the
// basics (name, handle, email, member-since) and a sign-out button. A
// fuller profile (stats, editing) can be built out later.

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import ProfileSignOutButton from "@/components/ProfileSignOutButton";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/profile");
  }

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { createdAt: true },
  });

  const memberSince = user?.createdAt.toLocaleDateString("en-US", {
    month: "long",
    year:  "numeric",
  });

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white px-8 py-12 flex flex-col items-center gap-6">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="w-20 h-20 rounded-full border border-zinc-700"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700" />
        )}

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold text-white">{session.user.name}</h1>
          {session.user.handle && (
            <p className="text-sm text-zinc-500">@{session.user.handle}</p>
          )}
        </div>

        <div className="w-full h-px bg-zinc-800" />

        <div className="w-full flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Email</span>
            <span className="text-zinc-300">{session.user.email}</span>
          </div>
          {memberSince && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Member since</span>
              <span className="text-zinc-300">{memberSince}</span>
            </div>
          )}
        </div>

        <ProfileSignOutButton />
      </div>
    </main>
  );
}
