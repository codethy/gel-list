// lib/productTypes.ts
//
// The curated set of product types an admin can add to a set's product
// catalog (see SetProduct in prisma/schema.prisma).

export const PRODUCT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "HOBBY_BOX", label: "Hobby Box" },
  { value: "BLASTER_BOX", label: "Blaster Box" },
  { value: "JUMBO_BOX", label: "Jumbo Box" },
  { value: "HANGER_BOX", label: "Hanger Box" },
  { value: "BOOSTER_PACK", label: "Booster Pack" },
  { value: "CASE", label: "Case" },
  { value: "ETB", label: "ETB" },
  { value: "BOOSTER_BUNDLE", label: "Booster Bundle" },
  { value: "UPC", label: "UPC" },
  { value: "SPC", label: "SPC" },
  { value: "BOOSTER_BOX", label: "Booster Box" },
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
