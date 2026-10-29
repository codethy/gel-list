// lib/productTypes.ts
//
// The curated set of product types an admin can add to a set's product
// catalog (see SetProduct in prisma/schema.prisma).

export const PRODUCT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "HOBBY_BOX", label: "Hobby Box" },
  { value: "HOBBY_PACK", label: "Hobby Pack" },
  { value: "BLASTER_BOX", label: "Blaster Box" },
  { value: "BLASTER_PACK", label: "Blaster Pack" },
  { value: "JUMBO_BOX", label: "Jumbo Box" },
  { value: "MEGA_BOX", label: "Mega Box" },
  { value: "BREAKERS_DELIGHT_BOX", label: "Breakers Delight Box" },
  { value: "HANGER_BOX", label: "Hanger Box" },
  { value: "HANGER_PACK", label: "Hanger Pack" },
  { value: "BOOSTER_PACK", label: "Booster Pack" },
  { value: "ETB", label: "ETB" },
  { value: "BOOSTER_BUNDLE", label: "Booster Bundle" },
  { value: "UPC", label: "UPC" },
  { value: "SPC", label: "SPC" },
  { value: "BOOSTER_BOX", label: "Booster Box" },
  { value: "TROVE", label: "Trove" },
  { value: "FDI", label: "FDI" },
  { value: "FANATICS_FEST", label: "Fanatics Fest" },
  { value: "HONG_BAO_BOX", label: "Hong Bao Box" },
  { value: "LOGOFRACTOR", label: "Logofractor" },
  { value: "OTHER", label: "Other" },
];

const PRODUCT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PRODUCT_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

// A SetProduct's display label — the custom text for an "Other" entry, or
// the standard label for everything else.
export function getProductLabel(
  productType: string,
  productTypeOther: string | null
): string {
  if (productType === "OTHER" && productTypeOther?.trim()) {
    return productTypeOther.trim();
  }
  return PRODUCT_TYPE_LABELS[productType] ?? productType;
}

// "Hobby Box" -> "Hobby Boxes", "Booster Pack" -> "Booster Packs", "ETB" ->
// "ETBs" — pluralizes just the last word of a product label, for the "X
// Hobby Boxes Opened" rows in the packs-opened breakdown (see
// lib/data/productOpenings.ts). Naive but handles every built-in label
// (and most plausible "Other" custom labels) correctly.
function pluralizeWord(word: string): string {
  if (/(x|s|sh|ch)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

export function pluralizeProductLabel(label: string): string {
  const words = label.trim().split(/\s+/);
  const last = words.pop();
  if (!last) return label;
  return [...words, pluralizeWord(last)].join(" ");
}
