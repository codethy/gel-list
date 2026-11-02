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
          <VerificationBadge isVerified={gel.isVerified} duplicateFlag={gel.duplicateFlag as "NONE" | "PENDING" | "VERIFIED_DUPLICATE" | "CLAIMING"} />
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

const DECISION_LABELS: Record<string, string> = {
  CONFIRMED_DUPLICATE:   "Confirmed Duplicate",
  NOT_DUPLICATE:         "Not a Duplicate",
  CLAIM_APPROVED:        "Claim Approved",
  CLAIM_REJECTED:        "Claim Rejected",
  CO_OWN_AWAITING_OWNER: "Awaiting Owner",
  CO_OWN_CONFIRMED:      "Co-Ownership Confirmed",
  CO_OWN_DENIED:         "Co-Ownership Denied",
  CO_OWN_UNSURE:         "Owner Unsure",
  PENDING:               "Pending Review",
};

function decisionBadgeClass(decision: string): string {
  if (decision === "CONFIRMED_DUPLICATE" || decision === "CLAIM_REJECTED" || decision === "CO_OWN_DENIED") {
    return "bg-red-500/15 text-red-300 border-red-500/30";
  }
  if (decision === "NOT_DUPLICATE") {
    return "bg-slate-600/20 text-slate-400 border-slate-600/40";
  }
  if (decision === "CLAIM_APPROVED" || decision === "CO_OWN_CONFIRMED") {
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  }
  if (decision === "CO_OWN_UNSURE") {
    return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  }
  return "bg-amber-500/15 text-amber-300 border-amber-500/30"; // PENDING, CO_OWN_AWAITING_OWNER
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
  onDecision: (fileId: string, action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE" | "APPROVE_CLAIM" | "REJECT_CLAIM" | "CONFIRM_CO_OWNERSHIP" | "DENY_CO_OWNERSHIP") => void;
  onToggleStatus: (fileId: string, action: "CLOSE" | "REOPEN") => void;
  onEditGel: (gel: AdminGelEntry) => void;
  onDeleteGel: (fileId: string, slot: "filedGel" | "existingGel", gelId: string) => void;
}) {
  const subtitle = playerSubtitle(file.checklistCard);
  const isClaim = file.fileType === "CLAIM";
  const isCoOwnership = file.fileType === "CO_OWNERSHIP";

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">
              Case #{file.fileNumber} &mdash; {file.checklistCard.playerName}
            </p>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                isClaim
                  ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                  : isCoOwnership
                  ? "bg-teal-500/15 text-teal-300 border-teal-500/30"
                  : "bg-sky-500/15 text-sky-300 border-sky-500/30"
              }`}
            >
              {isClaim ? "Claim" : isCoOwnership ? "Co-Ownership" : "Duplicate"}
            </span>
          </div>
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
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${decisionBadgeClass(file.decision)}`}
          >
            {DECISION_LABELS[file.decision] ?? file.decision}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <GelPanel
          gel={file.filedGel}
          title={isCoOwnership ? "Claiming Gel" : isClaim ? "Claiming Gel" : "Filed Gel"}
          busy={busy}
          onEdit={onEditGel}
          onDelete={(gelId) => onDeleteGel(file.id, "filedGel", gelId)}
        />
        <GelPanel
          gel={file.existingGel}
          title={isCoOwnership ? "Original Gel" : isClaim ? "Originally Reported Gel" : "Pre-Existing Gel"}
          busy={busy}
          onEdit={onEditGel}
          onDelete={(gelId) => onDeleteGel(file.id, "existingGel", gelId)}
        />
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {isCoOwnership ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(file.id, "CONFIRM_CO_OWNERSHIP")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              Confirm
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(file.id, "DENY_CO_OWNERSHIP")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
            >
              Deny
            </button>
          </>
        ) : isClaim ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(file.id, "APPROVE_CLAIM")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
            >
              Verify Claim
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecision(file.id, "REJECT_CLAIM")}
              className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-40 transition-colors"
            >
              Reject Claim
            </button>
          </>
        ) : (
          <>
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
          </>
        )}
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

  const handleDecision = useCallback(async (
    fileId: string,
    action: "CONFIRM_DUPLICATE" | "NOT_DUPLICATE" | "APPROVE_CLAIM" | "REJECT_CLAIM" | "CONFIRM_CO_OWNERSHIP" | "DENY_CO_OWNERSHIP"
  ) => {
    setBusyId(fileId);
    try {
      const res = await fetch(`/api/admin/duplicate-gels/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const decision = {
          CONFIRM_DUPLICATE:    "CONFIRMED_DUPLICATE",
          NOT_DUPLICATE:        "NOT_DUPLICATE",
          APPROVE_CLAIM:        "CLAIM_APPROVED",
          REJECT_CLAIM:         "CLAIM_REJECTED",
          CONFIRM_CO_OWNERSHIP: "CO_OWN_CONFIRMED",
          DENY_CO_OWNERSHIP:    "CO_OWN_DENIED",
        }[action];
        // Matches the server's exact per-gel update: a duplicate decision
        // flags both gels identically; a claim or co-ownership decision
        // only ever marks the filed gel isVerified on approval/confirm —
        // the existing gel only ever has its flag cleared.
        setFiles((prev) =>
          prev.map((f) => {
            if (f.id !== fileId) return f;
            if (action === "CONFIRM_DUPLICATE" || action === "NOT_DUPLICATE") {
              const duplicateFlag = action === "CONFIRM_DUPLICATE" ? "VERIFIED_DUPLICATE" : "NONE";
              return {
                ...f,
                decision,
                filedGel:    f.filedGel    ? { ...f.filedGel,    duplicateFlag } : null,
                existingGel: f.existingGel ? { ...f.existingGel, duplicateFlag } : null,
              };
            }
            const isVerifyingAction = action === "APPROVE_CLAIM" || action === "CONFIRM_CO_OWNERSHIP";
            return {
              ...f,
              decision,
              filedGel: f.filedGel
                ? { ...f.filedGel, duplicateFlag: "NONE", isVerified: isVerifyingAction ? true : f.filedGel.isVerified }
                : null,
              existingGel: f.existingGel ? { ...f.existingGel, duplicateFlag: "NONE" } : null,
            };
          })
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
