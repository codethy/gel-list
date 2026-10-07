// lib/taxonomy.ts
//
// Single source of truth for the Sports/Entertainment/TCG category taxonomy.
// `CardSet.subCategory` is a free-text column (not a real Postgres enum), so
// nothing at the database level stops it from drifting out of sync with the
// ids used by the home page's sidebar filter — that's exactly what happened
// when a set was created with subCategory "Tennis" while the filter checkbox
// expected "TENNIS". Both components/Sidebar.tsx (the filter UI) and
// app/api/sets/route.ts (the filter query) import from here, and
// prisma/create-set.ts / prisma/import-checklist.ts validate new sets
// against this same list before writing them — so this file is the only
// place a new subcategory is ever added.

export const TAXONOMY = [
  {
    id:         "Sports",
    label:      "Sports",
    enumValue:  "SPORTS",
    children: [
      { id: "SOCCER",      label: "Soccer"      },
      { id: "BASKETBALL",  label: "Basketball"  },
      { id: "BASEBALL",    label: "Baseball"    },
      { id: "FOOTBALL",    label: "Football"    },
      { id: "TENNIS",      label: "Tennis"      },
      { id: "HOCKEY",      label: "Hockey"      },
      { id: "RACING",      label: "Racing"      },
      { id: "GOLF",        label: "Golf"        },
      { id: "UFC_MMA",     label: "UFC / MMA"   },
      { id: "OTHER",       label: "Others"      },
    ],
  },
  {
    id:         "Entertainment",
    label:      "Entertainment",
    enumValue:  "ENTERTAINMENT",
    children: [
      { id: "DISNEY",       label: "Disney"       },
      { id: "MARVEL",       label: "Marvel"       },
      { id: "STAR_WARS",    label: "Star Wars"    },
      { id: "DC",           label: "DC"           },
      { id: "HARRY_POTTER", label: "Harry Potter" },
      { id: "FORTNITE",     label: "Fortnite"     },
      { id: "OTHER",        label: "Others"       },
    ],
  },
  {
    id:         "TradingCardGames",
    label:      "Trading Card Games",
    enumValue:  "TCG",
    children: [
      { id: "POKEMON",             label: "Pokemon"              },
      { id: "ONE_PIECE",           label: "One Piece"            },
      { id: "MAGIC_THE_GATHERING", label: "Magic: The Gathering" },
      { id: "YU_GI_OH",            label: "Yu-Gi-Oh"             },
      { id: "LORCANA",             label: "Disney Lorcana"       },
      { id: "RIFTBOUND",           label: "Riftbound"            },
      { id: "OTHER",               label: "Others"               },
    ],
  },
] as const;

// Flat map of every valid subcategory id → its parent Category enum value,
// e.g. "TENNIS" → "SPORTS". Used both by the home page's filter query (to
// also narrow on the indexed `category` column) and by the import scripts
// (to validate a new set's category/subCategory pair agree with each other).
export const SUBCATEGORY_TO_CATEGORY: Record<string, string> = Object.fromEntries(
  TAXONOMY.flatMap((parent) => parent.children.map((child) => [child.id, parent.enumValue]))
);

const VALID_SUBCATEGORY_IDS = new Set(Object.keys(SUBCATEGORY_TO_CATEGORY));

// Validates a subcategory value (as typed by hand into a set's config)
// against the canonical ids above. Matching is case-insensitive so "tennis"
// or "Tennis" are accepted, but the returned value is always the canonical
// uppercase id ("TENNIS") — that's what actually needs to end up stored in
// CardSet.subCategory for the sidebar filter to find it.
export function resolveSubCategory(raw: string): { valid: string | null; error: string | null } {
  const match = [...VALID_SUBCATEGORY_IDS].find((id) => id.toLowerCase() === raw.trim().toLowerCase());
  if (match) return { valid: match, error: null };
  return {
    valid: null,
    error: `"${raw}" is not a recognized subCategory. Valid values are: ${[...VALID_SUBCATEGORY_IDS].join(", ")}`,
  };
}
