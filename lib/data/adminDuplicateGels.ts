// lib/data/adminDuplicateGels.ts
//
// Data layer for /admin/duplicate-gels — every DuplicateGelFile, each
// carrying full contact info (username/handle/email) for both the filer
// and the original gel's owner, plus both gels' full admin-review details
// (reusing AdminGelEntry's shape so AdminEditGelModal works unchanged).
// Not paginated — duplicate files should be rare, same "load everything"
// convention as getAllLoggedGelsGrouped in lib/data/adminGels.ts.

import { prisma } from "@/lib/prisma";
import type { AdminGelEntry } from "@/lib/data/adminGels";

export interface DuplicateFileUser {
  id:       string;
  username: string | null;
  handle:   string | null;
  email:    string | null;
  name:     string | null;
}

export interface DuplicateFileGel extends AdminGelEntry {
  loggedByUser: DuplicateFileUser;
}

export interface AdminDuplicateFile {
  id:         string;
  fileNumber: number;
  status:     string;
  decision:   string;
  createdAt:  string;
  checklistCard: {
    id:            string;
    playerName:    string;
    cardType:      string;
    parallelType:  string | null;
    printRun:      number | null;
    variationName: string | null;
    team:          string | null;
    setId:         string;
    setName:       string;
  };
  filedByUser: DuplicateFileUser;
  // null if the admin has since deleted that gel — the file survives for
  // audit with that slot empty (see prisma/schema.prisma's onDelete: SetNull).
  filedGel:    DuplicateFileGel | null;
  existingGel: DuplicateFileGel | null;
}

const userSelect = { id: true, username: true, handle: true, email: true, name: true } as const;

const gelSelect = {
  id:                true,
  isInHand:          true,
  isVerified:        true,
  duplicateFlag:     true,
  acquisitionMethod: true,
  serialNumber:      true,
  hitYear:           true,
  hitMonth:          true,
  hitCity:           true,
  hitCountry:        true,
  cardFrontImageUrl: true,
  cardBackImageUrl:  true,
  seller:            true,
  notes:             true,
  createdAt:         true,
  user:              { select: userSelect },
  checklistCard: {
    select: {
      id:            true,
      playerName:    true,
      cardCategory:  true,
      parallel:      true,
      printRun:      true,
      variationName: true,
      team:          true,
    },
  },
} as const;

function shapeUser(u: { id: string; username: string | null; handle: string | null; email: string | null; name: string | null }): DuplicateFileUser {
  return { id: u.id, username: u.username, handle: u.handle, email: u.email, name: u.name };
}

function shapeGel(pc: {
  id: string; isInHand: boolean; isVerified: boolean; duplicateFlag: unknown;
  acquisitionMethod: unknown; serialNumber: number | null; hitYear: number | null;
  hitMonth: number | null; hitCity: string | null; hitCountry: string | null;
  cardFrontImageUrl: string | null; cardBackImageUrl: string | null;
  seller: string | null; notes: string | null; createdAt: Date;
  user: { id: string; username: string | null; handle: string | null; email: string | null; name: string | null };
  checklistCard: { id: string; playerName: string; cardCategory: unknown; parallel: string | null; printRun: number | null; variationName: string | null; team: string | null };
}): DuplicateFileGel {
  return {
    id:                  pc.id,
    isInHand:            pc.isInHand,
    isVerified:          pc.isVerified,
    duplicateFlag:       String(pc.duplicateFlag),
    acquisitionMethod:   pc.acquisitionMethod != null ? String(pc.acquisitionMethod) : null,
    serialNumber:        pc.serialNumber ?? null,
    hitYear:             pc.hitYear      ?? null,
    hitMonth:            pc.hitMonth     ?? null,
    hitCity:             pc.hitCity      ?? null,
    hitCountry:          pc.hitCountry   ?? null,
    cardFrontImageUrl:   pc.cardFrontImageUrl ?? null,
    cardBackImageUrl:    pc.cardBackImageUrl  ?? null,
    seller:              pc.seller ?? null,
    notes:               pc.notes  ?? null,
    createdAt:           pc.createdAt.toISOString(),
    loggedByUsername:    pc.user.username ?? pc.user.name ?? "user",
    loggedByDisplayName: pc.user.name ?? null,
    loggedByUser:        shapeUser(pc.user),
    checklistCard: {
      id:            pc.checklistCard.id,
      playerName:    pc.checklistCard.playerName,
      cardType:      String(pc.checklistCard.cardCategory),
      parallelType:  pc.checklistCard.parallel ?? null,
      printRun:      pc.checklistCard.printRun ?? null,
      variationName: pc.checklistCard.variationName ?? null,
      team:          pc.checklistCard.team ?? null,
    },
  };
}

export async function getAllDuplicateFiles(): Promise<AdminDuplicateFile[]> {
  const files = await prisma.duplicateGelFile.findMany({
    orderBy: { fileNumber: "desc" },
    select: {
      id:         true,
      fileNumber: true,
      status:     true,
      decision:   true,
      createdAt:  true,
      checklistCard: {
        select: {
          id:            true,
          playerName:    true,
          cardCategory:  true,
          parallel:      true,
          printRun:      true,
          variationName: true,
          team:          true,
          cardSet:       { select: { id: true, name: true } },
        },
      },
      filedByUser: { select: userSelect },
      filedGel:    { select: gelSelect },
      existingGel: { select: gelSelect },
    },
  });

  return files.map((f) => ({
    id:         f.id,
    fileNumber: f.fileNumber,
    status:     String(f.status),
    decision:   String(f.decision),
    createdAt:  f.createdAt.toISOString(),
    checklistCard: {
      id:            f.checklistCard.id,
      playerName:    f.checklistCard.playerName,
      cardType:      String(f.checklistCard.cardCategory),
      parallelType:  f.checklistCard.parallel ?? null,
      printRun:      f.checklistCard.printRun ?? null,
      variationName: f.checklistCard.variationName ?? null,
      team:          f.checklistCard.team ?? null,
      setId:         f.checklistCard.cardSet.id,
      setName:       f.checklistCard.cardSet.name,
    },
    filedByUser: shapeUser(f.filedByUser),
    filedGel:    f.filedGel    ? shapeGel(f.filedGel)    : null,
    existingGel: f.existingGel ? shapeGel(f.existingGel) : null,
  }));
}
