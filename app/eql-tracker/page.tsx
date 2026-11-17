// app/eql-tracker/page.tsx
//
// Public EQL Tracker — lists every set an admin has enrolled (see
// app/admin/eql-tracker/page.tsx) and lets any visitor, signed in or not,
// self-report whether their entry for one of that set's EQL options
// succeeded or failed. Signed-in visitors additionally see their own
// aggregate attempt/success/fail stats; signed-out visitors see a
// "Sign in to see your EQL history" prompt instead.

import { auth } from "@/auth";
import { listEqlSets, getUserEqlStats } from "@/lib/data/eqlTracker";
import EqlTrackerClient from "@/components/EqlTrackerClient";

export default async function EqlTrackerPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [sets, userStats] = await Promise.all([
    listEqlSets(),
    userId ? getUserEqlStats(userId) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-1">EQL Tracker</h1>
        <p className="text-sm text-slate-400 mb-8">
          Log your own EQL drop results and see how others did.
        </p>

        <EqlTrackerClient
          sets={sets.map((s) => ({ id: s.id, setName: s.setName }))}
          isSignedIn={Boolean(userId)}
          userStats={userStats}
        />
      </div>
    </div>
  );
}
