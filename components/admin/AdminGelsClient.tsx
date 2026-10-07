// components/admin/AdminGelsClient.tsx
"use client";

import { useState, useCallback } from "react";
import { playerSubtitle } from "@/components/set-detail/ChecklistTable";
import type { AdminSetGroup, AdminGelEntry } from "@/lib/data/adminGels";
import AdminEditGelModal from "./AdminEditGelModal";

const ACQUISITION_LABELS: Record<string, string> = {
  PULLED:       "Pulled",
  BOUGHT:       "Bought",
  BREAKER:      "Breaker",
  EBAY:         "eBay",
  FRIEND:       "Friend",
  SOCIAL_MEDIA: "Social Media",
  OTHER:        "Others",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function GelRow({
  gel,
  onVerify,
  onReject,
  onDelete,
  onEdit,
  busy,
}: {
  gel: AdminGelEntry;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (gel: AdminGelEntry) => void;
  busy: boolean;
}) {
  const subtitle = playerSubtitle(gel.checklistCard);
  const image = gel.cardFrontImageUrl ?? gel.cardBackImageUrl;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
      <div className="shrink-0">
        {image ? (
          <img src={image} alt="" className="w-10 h-14 object-cover rounded-sm border border-slate-700/50" />
        ) : (
          <div className="w-10 h-14 rounded-sm border border-slate-700/40 bg-slate-800/60" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-200 truncate">{gel.checklistCard.playerName}</p>
        {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        <p className="text-[11px] text-slate-500 mt-1">
          Logged by <span className="text-slate-400">{gel.loggedByDisplayName ?? gel.loggedByUsername}</span>
          {" · "}
          {formatDate(gel.createdAt)}
          {gel.serialNumber != null && <> · #{gel.serialNumber}</>}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {gel.acquisitionMethod
            ? (gel.isInHand ? "How: " : "Who pulled it: ") + (ACQUISITION_LABELS[gel.acquisitionMethod] ?? gel.acquisitionMethod)
            : null}
        </p>
        {gel.notes && (
          <p className="text-[11px] text-slate-400 italic mt-1 truncate" title={gel.notes}>
            &ldquo;{gel.notes}&rdquo;
          </p>
        )}
      </div>

      <div className="shrink-0 flex flex-col items-end gap-1.5">
        {gel.isVerified ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            Verified
          </span>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onVerify(gel.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              Verify
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onReject(gel.id)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
            >
              False
            </button>
          </div>
        )}
        <div className="flex gap-3 mt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onEdit(gel)}
            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium disabled:opacity-40 transition-colors"
          >
            Edit
          </button>
          {gel.isVerified && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(gel.id)}
              className="text-[11px] text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SubGroup({
  title,
  gels,
  ...rowProps
}: {
  title: string;
  gels: AdminGelEntry[];
} & Omit<React.ComponentProps<typeof GelRow>, "gel">) {
  if (gels.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {title} <span className="text-slate-600 normal-case">({gels.length})</span>
      </h3>
      <div className="space-y-2">
        {gels.map((gel) => (
          <GelRow key={gel.id} gel={gel} {...rowProps} />
        ))}
      </div>
    </div>
  );
}

export default function AdminGelsClient({ initialGroups }: { initialGroups: AdminSetGroup[] }) {
  const [groups, setGroups] = useState(initialGroups);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingGel, setEditingGel] = useState<AdminGelEntry | null>(null);

  const removeGel = useCallback((id: string) => {
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          ownGels: g.ownGels.filter((gel) => gel.id !== id),
          otherGels: g.otherGels.filter((gel) => gel.id !== id),
        }))
        .filter((g) => g.ownGels.length > 0 || g.otherGels.length > 0)
    );
  }, []);

  const markVerified = useCallback((id: string) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        ownGels: g.ownGels.map((gel) => (gel.id === id ? { ...gel, isVerified: true } : gel)),
        otherGels: g.otherGels.map((gel) => (gel.id === id ? { ...gel, isVerified: true } : gel)),
      }))
    );
  }, []);

  const handleVerify = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY" }),
      });
      if (res.ok) markVerified(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to verify");
    } finally {
      setBusyId(null);
    }
  }, [markVerified]);

  const handleReject = useCallback(async (id: string) => {
    if (!confirm("Mark this gel as false? It will be permanently removed.")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "FALSE" }),
      });
      if (res.ok) removeGel(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to reject");
    } finally {
      setBusyId(null);
    }
  }, [removeGel]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Delete this gel permanently?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/gels/${id}`, { method: "DELETE" });
      if (res.ok) removeGel(id);
      else alert((await res.json().catch(() => ({})))?.error ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }, [removeGel]);

  const handleEditSuccess = useCallback((updated: { id: string; isInHand: boolean }) => {
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        ownGels: g.ownGels.filter((gel) => gel.id !== updated.id),
        otherGels: g.otherGels.filter((gel) => gel.id !== updated.id),
      }))
    );
    // Simplest correct way to reflect a possible SELF/OTHER switch or edited
    // fields is to just refetch — this view is a low-traffic admin tool, not
    // worth hand-patching every field client-side.
    fetch("/api/admin/gels")
      .then((r) => r.json())
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => {});
    setEditingGel(null);
  }, []);

  if (groups.length === 0) {
    return <p className="text-sm text-slate-500 italic">No logged gels yet.</p>;
  }

  const rowProps = {
    onVerify: handleVerify,
    onReject: handleReject,
    onDelete: handleDelete,
    onEdit: setEditingGel,
  };

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.setId} className="space-y-4">
          <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-2">{group.setName}</h2>
          <SubGroup title="My Own Gel" gels={group.ownGels} {...rowProps} busy={busyId !== null} />
          <SubGroup title="Someone Else's Gel" gels={group.otherGels} {...rowProps} busy={busyId !== null} />
        </section>
      ))}

      <AdminEditGelModal
        gel={editingGel}
        onClose={() => setEditingGel(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
