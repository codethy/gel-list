// components/admin/AdminDuplicateGelsClient.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { playerSubtitle, VerificationBadge } from "@/components/set-detail/ChecklistTable";
import type { AdminDuplicateFile, DuplicateFileGel, DuplicateFileUser } from "@/lib/data/adminDuplicateGels";
import type { AdminGelEntry } from "@/lib/data/adminGels";
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

function UserDetails({ user, label }: { user: DuplicateFileUser; label: string }) {
  return (
    <div className="text-[11px] text-slate-400 leading-snug">
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-200 font-semibold">{user.name ?? user.username ?? "A user"}</span>
      {user.handle && <span className="text-slate-500"> &bull; @{user.handle}</span>}
      {user.email && <span className="text-slate-500"> &bull; {user.email}</span>}
    </div>
  );
}

function GelPanel({
  gel,
  title,
  busy,
  onEdit,
  onDelete,
}: {
  gel: DuplicateFileGel | null;
  title: string;
  busy: boolean;
  onEdit: (gel: AdminGelEntry) => void;
  onDelete: (gelId: string) => void;
}) {
  if (!gel) {
    return (
      <div className="flex-1 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-xs text-slate-600 italic">Removed by the developer.</p>
      </div>
    );
  }

  const image = gel.cardFrontImageUrl ?? gel.cardBackImageUrl;

  return (
    <div className="flex-1 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{title}</p>
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          {image ? (
            <Image src={image} alt="" width={40} height={56} className="w-10 h-14 object-cover rounded-sm border border-slate-700/50" />
          ) : (
            <div className="w-10 h-14 rounded-sm border border-slate-700/40 bg-slate-800/60" />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <UserDetails user={gel.loggedByUser} label="Logged by" />
          <p className="text-[11px] text-slate-500">
            {gel.serialNumber != null && <>#{gel.serialNumber} &bull; </>}
            {formatDate(gel.createdAt)}
          </p>
          {gel.acquisitionMethod && (
            <p className="text-[11px] text-slate-500">
              {ACQUISITION_LABELS[gel.acquisitionMethod] ?? gel.acquisitionMethod}
              {gel.seller ? ` from ${gel.seller}` : ""}
            </p>
          )}
          {gel.notes && (
            <p className="text-[11px] text-slate-400 italic truncate" title={gel.notes}>
              &ldquo;{gel.notes}&rdquo;
            </p>
          )}
          <VerificationBadge isVerified={gel.isVerified} duplicateFlag={gel.duplicateFlag as "NONE" | "PENDING" | "VERIFIED_DUPLICATE"} />
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onEdit(gel)}
          className="text-[11px] text-blue-400 hover:text-blue-300 font-medium disabled:opacity-40 transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDelete(gel.id)}
          className="text-[11px] text-red-400 hover:text-red-300 font-medium disabled:opacity-40 transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

function FileCard({
  file,
  busy,
  onDecision,
  onToggleStatus,
  onEditGel,
  onDeleteGel,
}: {
  file: AdminDuplicateFile;
  busy: boolean;
  onDecision: (fileId: string, action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE") => void;
  onToggleStatus: (fileId: string, action: "CLOSE" | "REOPEN") => void;
  onEditGel: (gel: AdminGelEntry) => void;
  onDeleteGel: (fileId: string, slot: "filedGel" | "existingGel", gelId: string) => void;
}) {
  const subtitle = playerSubtitle(file.checklistCard);

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            Case #{file.fileNumber} &mdash; {file.checklistCard.playerName}
          </p>
          <p className="text-xs text-slate-500">
            {file.checklistCard.setName}
            {subtitle ? ` — ${subtitle}` : ""}
            {file.checklistCard.team ? ` — ${file.checklistCard.team}` : ""}
          </p>
          <UserDetails user={file.filedByUser} label="Filed by" />
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              file.status === "CLOSED"
                ? "bg-slate-600/20 text-slate-400 border-slate-600/40"
                : "bg-blue-500/15 text-blue-300 border-blue-500/30"
            }`}
          >
            {file.status === "CLOSED" ? "Closed" : "Open"}
          </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
              file.decision === "CONFIRMED_DUPLICATE"
                ? "bg-red-500/15 text-red-300 border-red-500/30"
                : file.decision === "NOT_DUPLICATE"
                ? "bg-slate-600/20 text-slate-400 border-slate-600/40"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30"
            }`}
          >
            {file.decision === "CONFIRMED_DUPLICATE" ? "Confirmed Duplicate" : file.decision === "NOT_DUPLICATE" ? "Not a Duplicate" : "Pending Review"}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <GelPanel
          gel={file.filedGel}
          title="Filed Gel"
          busy={busy}
          onEdit={onEditGel}
          onDelete={(gelId) => onDeleteGel(file.id, "filedGel", gelId)}
        />
        <GelPanel
          gel={file.existingGel}
          title="Pre-Existing Gel"
          busy={busy}
          onEdit={onEditGel}
          onDelete={(gelId) => onDeleteGel(file.id, "existingGel", gelId)}
        />
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(file.id, "CONFIRM_DUPLICATE")}
          className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
        >
          Verify Duplicate is Real
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecision(file.id, "NOT_DUPLICATE")}
          className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-700 disabled:opacity-40 transition-colors"
        >
          Not a Duplicate
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleStatus(file.id, file.status === "CLOSED" ? "REOPEN" : "CLOSE")}
          className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-700 disabled:opacity-40 transition-colors ml-auto"
        >
          {file.status === "CLOSED" ? "Reopen" : "Close"}
        </button>
      </div>
    </div>
  );
}

export default function AdminDuplicateGelsClient({ initialFiles }: { initialFiles: AdminDuplicateFile[] }) {
  const [files, setFiles] = useState(initialFiles);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingGel, setEditingGel] = useState<AdminGelEntry | null>(null);

  const patchFile = useCallback((fileId: string, patch: Partial<AdminDuplicateFile>) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f)));
  }, []);

  const handleDecision = useCallback(async (fileId: string, action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE") => {
    setBusyId(fileId);
    try {
      const res = await fetch(`/api/admin/duplicate-gels/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const decision = action === "CONFIRM_DUPLICATE" ? "CONFIRMED_DUPLICATE" : "NOT_DUPLICATE";
        const duplicateFlag = action === "CONFIRM_DUPLICATE" ? "VERIFIED_DUPLICATE" : "NONE";
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  decision,
                  filedGel:    f.filedGel    ? { ...f.filedGel,    duplicateFlag } : null,
                  existingGel: f.existingGel ? { ...f.existingGel, duplicateFlag } : null,
                }
              : f
          )
        );
      } else {
        alert((await res.json().catch(() => ({})))?.error ?? "Failed to update file");
      }
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleToggleStatus = useCallback(async (fileId: string, action: "CLOSE" | "REOPEN") => {
    setBusyId(fileId);
    try {
      const res = await fetch(`/api/admin/duplicate-gels/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        patchFile(fileId, { status: action === "CLOSE" ? "CLOSED" : "OPEN" });
      } else {
        alert((await res.json().catch(() => ({})))?.error ?? "Failed to update file");
      }
    } finally {
      setBusyId(null);
    }
  }, [patchFile]);

  const handleDeleteGel = useCallback(async (fileId: string, slot: "filedGel" | "existingGel", gelId: string) => {
    if (!confirm("Delete this gel permanently? The file will stay visible for audit.")) return;
    setBusyId(fileId);
    try {
      const res = await fetch(`/api/admin/gels/${gelId}`, { method: "DELETE" });
      if (res.ok) {
        patchFile(fileId, { [slot]: null } as Partial<AdminDuplicateFile>);
      } else {
        alert((await res.json().catch(() => ({})))?.error ?? "Failed to delete gel");
      }
    } finally {
      setBusyId(null);
    }
  }, [patchFile]);

  const handleEditSuccess = useCallback((updated: { id: string }) => {
    // Simplest correct way to reflect edited fields on whichever gel/slot
    // this belonged to — same "just refetch" rationale as AdminGelsClient.
    fetch("/api/admin/duplicate-gels")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.files) setFiles(data.files);
      })
      .catch(() => {});
    setEditingGel(null);
    void updated;
  }, []);

  if (files.length === 0) {
    return <p className="text-sm text-slate-500 italic">No duplicate gel files yet.</p>;
  }

  return (
    <div className="space-y-4">
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          busy={busyId === file.id}
          onDecision={handleDecision}
          onToggleStatus={handleToggleStatus}
          onEditGel={setEditingGel}
          onDeleteGel={handleDeleteGel}
        />
      ))}

      <AdminEditGelModal
        gel={editingGel}
        onClose={() => setEditingGel(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
