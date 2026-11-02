"use client";
// components/NotificationBell.tsx
//
// Bell icon + unread-count dot in Navbar.tsx, right before the avatar.
// No dedicated notifications page — clicking opens a dropdown panel that
// fetches the latest ~20 (GET /api/notifications, which also marks them
// read server-side). The badge count itself is polled lightly via
// GET /api/notifications/unread-count so we're not re-fetching the full
// list on an interval.

import { useState, useEffect, useRef, useCallback } from "react";

interface AppNotification {
  id:                 string;
  type:               string;
  isRead:             boolean;
  createdAt:          string;
  duplicateGelFileId: string | null;
  decision:           string | null;
  acquisitionMethod:  string | null;
  acquisitionLabel:   string | null;
  claimerName:        string | null;
  claimerHandle:      string | null;
  ownerName:          string | null;
  cardPlayerName:     string | null;
  cardSubtitle:       string | null;
  serialNumber:       number | null;
}

function cardLabel(n: AppNotification): string {
  const parts = [n.cardPlayerName, n.cardSubtitle].filter(Boolean);
  let label = parts.length > 0 ? parts.join(" — ") : "a card";
  if (n.serialNumber != null) label += ` #${n.serialNumber}`;
  return label;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(typeof data.count === "number" ? data.count : 0);
      }
    } catch {
      // Polling — a transient failure just tries again next interval.
    }
  }, []);

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleOpen = useCallback(() => {
    setOpen((prevOpen) => {
      const next = !prevOpen;
      if (next) {
        setUnreadCount(0);
        fetch("/api/notifications")
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.notifications) setNotifications(data.notifications);
          })
          .catch(() => {});
      }
      return next;
    });
  }, []);

  const handleRespond = useCallback(async (notificationId: string, decision: "CONFIRM" | "DENY" | "UNSURE") => {
    setRespondingId(notificationId);
    try {
      const res = await fetch(`/api/notifications/${notificationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        const resultDecision = { CONFIRM: "CO_OWN_CONFIRMED", DENY: "CO_OWN_DENIED", UNSURE: "CO_OWN_UNSURE" }[decision];
        setNotifications((prev) =>
          prev ? prev.map((n) => (n.id === notificationId ? { ...n, decision: resultDecision } : n)) : prev
        );
      } else {
        alert((await res.json().catch(() => ({})))?.error ?? "Failed to respond");
      }
    } finally {
      setRespondingId(null);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-red-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[28rem] overflow-y-auto rounded-xl bg-[#1a1a1a] border border-zinc-800 shadow-xl z-50">
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-sm font-semibold text-white">Notifications</p>
          </div>
          {notifications === null ? (
            <p className="px-4 py-6 text-xs text-zinc-500 text-center">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-xs text-zinc-500 text-center">No notifications yet.</p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {notifications.map((n) => (
                <li key={n.id} className="px-4 py-3 space-y-2">
                  {n.type === "CO_OWNERSHIP_REQUEST" ? (
                    <>
                      <p className="text-xs text-zinc-300 leading-snug">
                        <span className="font-semibold text-white">{n.claimerName ?? "A user"}</span>
                        {n.claimerHandle && <span className="text-zinc-500"> @{n.claimerHandle}</span>}
                        {" "}is claiming they {n.acquisitionLabel ?? "acquired"} {cardLabel(n)}. Is that true?
                      </p>
                      {n.decision === "CO_OWN_AWAITING_OWNER" ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={respondingId === n.id}
                            onClick={() => handleRespond(n.id, "CONFIRM")}
                            className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={respondingId === n.id}
                            onClick={() => handleRespond(n.id, "DENY")}
                            className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
                          >
                            Deny
                          </button>
                          <button
                            type="button"
                            disabled={respondingId === n.id}
                            onClick={() => handleRespond(n.id, "UNSURE")}
                            className="flex-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-700 disabled:opacity-40 transition-colors"
                          >
                            Unsure
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-500 italic">
                          {n.decision === "CO_OWN_CONFIRMED" && "You confirmed this request."}
                          {n.decision === "CO_OWN_DENIED" && "You denied this request."}
                          {n.decision === "CO_OWN_UNSURE" && "Marked unsure — awaiting admin review."}
                        </p>
                      )}
                    </>
                  ) : n.type === "CO_OWNERSHIP_DENIED" ? (
                    <p className="text-xs text-zinc-300 leading-snug">
                      Your claim that you {n.acquisitionLabel ?? "acquired"} {cardLabel(n)} was denied by{" "}
                      {n.ownerName ?? "the gel's owner"}.
                    </p>
                  ) : null}
                  <p className="text-[10px] text-zinc-600">{formatRelativeTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
