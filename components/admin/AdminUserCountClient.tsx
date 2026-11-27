// components/admin/AdminUserCountClient.tsx
//
// Live-updating total-accounts counter for /admin/users — polls
// GET /api/admin/users/count every 5s (same polling approach as
// NotificationBell's unread-count badge, just a tighter interval since
// this page exists specifically to watch the number move).

"use client";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 5000;

export default function AdminUserCountClient({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      try {
        const res = await fetch("/api/admin/users/count");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") {
          setCount(data.count);
          setLastUpdated(new Date());
        }
      } catch {
        // Transient network error — the next poll will retry.
      }
    }

    // Paused while the tab isn't visible — this page is left open on a
    // monitor/second tab more than most, and a 5s interval left running in
    // the background was enough on its own to keep the DB from ever going
    // idle. Resumes immediately (not just on the next interval tick) the
    // moment the tab is foregrounded again.
    function startPolling() {
      if (interval) return;
      interval = setInterval(poll, POLL_INTERVAL_MS);
    }

    function stopPolling() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        poll();
        startPolling();
      } else {
        stopPolling();
      }
    }

    if (document.visibilityState === "visible") startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-slate-900/40 border border-slate-800">
      <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Total Accounts Created
      </p>
      <p className="text-7xl font-bold text-white tabular-nums">{count.toLocaleString()}</p>
      <p className="text-xs text-slate-600 mt-4">
        Updates automatically &bull; last refreshed {lastUpdated.toLocaleTimeString()}
      </p>
    </div>
  );
}
