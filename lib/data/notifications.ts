// lib/data/notifications.ts
//
// Shown via the bell icon in Navbar.tsx (see components/NotificationBell.tsx)
// — no dedicated page. Currently only used for the CO_OWNERSHIP claim flow
// (see prisma/schema.prisma's Notification model and
// app/api/sets/[id]/gels/co-claim/route.ts): the original gel's owner is
// asked to confirm/deny/defer a co-ownership request once their own gel
// is verified, and the claimer is told if their request is denied.

import { prisma } from "@/lib/prisma";

const ACQUISITION_LABELS: Record<string, string> = {
  PULLED: "pulled",
  BOUGHT: "bought",
};

export interface AppNotification {
  id:                 string;
  type:               string;
  isRead:             boolean;
  createdAt:          string;
  duplicateGelFileId: string | null;
  // Rendering context, all derived from the linked DuplicateGelFile — null
  // if the file was somehow removed (shouldn't normally happen, onDelete:
  // Cascade removes the notification too, but defensive regardless).
  decision:          string | null;
  acquisitionMethod: string | null; // "PULLED" | "BOUGHT" — the claimed gel's
  acquisitionLabel:  string | null; // "pulled" | "bought", for display
  claimerName:       string | null;
  claimerHandle:     string | null;
  ownerName:         string | null;
  cardPlayerName:    string | null;
  cardSubtitle:      string | null; // parallel/variation, same style as playerSubtitle
  serialNumber:      number | null;
}

const notificationSelect = {
  id:        true,
  type:      true,
  isRead:    true,
  createdAt: true,
  duplicateGelFileId: true,
  duplicateGelFile: {
    select: {
      decision: true,
      filedGel: { select: { acquisitionMethod: true, serialNumber: true } },
      filedByUser: { select: { name: true, username: true, handle: true } },
      existingGel: { select: { user: { select: { name: true, username: true } } } },
      checklistCard: { select: { playerName: true, parallel: true, variationName: true } },
    },
  },
} as const;

function shape(n: {
  id: string; type: unknown; isRead: boolean; createdAt: Date; duplicateGelFileId: string | null;
  duplicateGelFile: {
    decision: unknown;
    filedGel: { acquisitionMethod: unknown; serialNumber: number | null } | null;
    filedByUser: { name: string | null; username: string | null; handle: string | null };
    existingGel: { user: { name: string | null; username: string | null } } | null;
    checklistCard: { playerName: string; parallel: string | null; variationName: string | null };
  } | null;
}): AppNotification {
  const file = n.duplicateGelFile;
  const acquisitionMethod = file?.filedGel?.acquisitionMethod != null ? String(file.filedGel.acquisitionMethod) : null;
  const subtitleParts = [file?.checklistCard.variationName, file?.checklistCard.parallel].filter(Boolean);

  return {
    id:                 n.id,
    type:               String(n.type),
    isRead:             n.isRead,
    createdAt:          n.createdAt.toISOString(),
    duplicateGelFileId: n.duplicateGelFileId,
    decision:           file ? String(file.decision) : null,
    acquisitionMethod,
    acquisitionLabel:   acquisitionMethod ? (ACQUISITION_LABELS[acquisitionMethod] ?? acquisitionMethod.toLowerCase()) : null,
    claimerName:        file?.filedByUser.name ?? file?.filedByUser.username ?? null,
    claimerHandle:      file?.filedByUser.handle ?? null,
    ownerName:          file?.existingGel?.user.name ?? file?.existingGel?.user.username ?? null,
    cardPlayerName:     file?.checklistCard.playerName ?? null,
    cardSubtitle:       subtitleParts.length > 0 ? subtitleParts.join(" ") : null,
    serialNumber:       file?.filedGel?.serialNumber ?? null,
  };
}

export async function getNotificationsForUser(userId: string, limit = 20): Promise<AppNotification[]> {
  const notifications = await prisma.notification.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    take:    limit,
    select:  notificationSelect,
  });
  return notifications.map(shape);
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.notification.updateMany({ where: { id: { in: ids } }, data: { isRead: true } });
}

export async function createCoOwnershipRequestNotification(fileId: string, recipientUserId: string): Promise<void> {
  await prisma.notification.create({
    data: {
      user:             { connect: { id: recipientUserId } },
      type:             "CO_OWNERSHIP_REQUEST",
      duplicateGelFile: { connect: { id: fileId } },
    },
  });
}

export async function createCoOwnershipDeniedNotification(fileId: string, recipientUserId: string): Promise<void> {
  await prisma.notification.create({
    data: {
      user:             { connect: { id: recipientUserId } },
      type:             "CO_OWNERSHIP_DENIED",
      duplicateGelFile: { connect: { id: fileId } },
    },
  });
}

// Called whenever a gel's isVerified flips to true (admin verify, or the
// user's own edit re-computing it) — finds any CO_OWNERSHIP file still
// waiting on THIS gel to be verified before notifying its owner, flips it
// to "awaiting owner," and sends the notification. A no-op for every
// other gel (the common case), and only ever fires once per file since
// decision is no longer PENDING afterward.
export async function maybeSendPendingCoOwnershipNotifications(gelId: string): Promise<void> {
  const files = await prisma.duplicateGelFile.findMany({
    where:  { existingGelId: gelId, fileType: "CO_OWNERSHIP", decision: "PENDING" },
    select: { id: true, existingGelId: true },
  });
  for (const file of files) {
    if (!file.existingGelId) continue;
    const existingGel = await prisma.portfolioCard.findUnique({
      where:  { id: file.existingGelId },
      select: { userId: true },
    });
    if (!existingGel) continue;
    await prisma.duplicateGelFile.update({
      where: { id: file.id },
      data:  { decision: "CO_OWN_AWAITING_OWNER" },
    });
    await createCoOwnershipRequestNotification(file.id, existingGel.userId);
  }
}
