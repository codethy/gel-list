// lib/initials.ts
//
// Shared "default avatar" initials helper — used by ProfileAccountCard
// (profile pages) and Navbar (top bar) wherever a user has no uploaded
// profile picture.

const MAX_INITIALS = 3;

// "Michael" -> "M", "Michael Jordan" -> "MJ" — one letter per word, capped
// at MAX_INITIALS for long names.
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, MAX_INITIALS)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
