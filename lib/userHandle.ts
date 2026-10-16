// lib/userHandle.ts

import type { PrismaClient } from "@prisma/client";

const HANDLE_LENGTH = 5;
const HANDLE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomHandle(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += HANDLE_CHARS[Math.floor(Math.random() * HANDLE_CHARS.length)];
  }
  return result;
}

// Generates a random lowercase-alphanumeric handle and retries on collision
// until it finds one no other user already has.
export async function generateUniqueHandle(
  prisma: Pick<PrismaClient, "user">,
  length: number = HANDLE_LENGTH
): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = randomHandle(length);
    const existing = await prisma.user.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique user handle after 25 attempts");
}
