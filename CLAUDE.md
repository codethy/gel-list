# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (localhost:3000)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint-config-next)
```

There is no test suite / test script in this repo currently.

Prisma (schema lives in `prisma/schema.prisma`, Postgres only):

```bash
npx prisma generate          # regenerate the client after schema changes
npx prisma migrate dev       # create/apply a migration in development
npx tsx prisma/import-checklist.ts <set-slug> [--dry-run]   # bulk-import a set's checklist from XLSX
                                                              # (config: prisma/imports/<set-slug>/set.json)
npx tsx prisma/create-set.ts         # create a single CardSet record
```

`prisma/seed.ts` and `prisma/clear-test-data.ts` (and the `db seed` command) have been removed — they referenced the long-gone `CardType` enum and the removed `CardTemplate` model, predating a Postgres-backed test/dev database split that never existed here (this project has one database, referenced by `DATABASE_URL` in `.env.local`).

`prisma.config.ts` (Prisma 7's config file, not the old schema-embedded config) manually loads `.env.local` via `dotenv` before running any Prisma CLI command — the Prisma CLI does not read Next.js's `.env.local` on its own. Required env vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. `UPLOADTHING_*` and `PUSHER_*` vars are also present in `.env.local` but nothing in the app currently uses those packages.

## Architecture

**Gel List** is a card-collection tracker (sports/TCG/entertainment cards). Users browse official card **sets**, view a set's **checklist** of cards, and log the physical cards they own (**"gels"**) against checklist entries.

### Data layer (Prisma 7, driver-adapter pattern)

`lib/prisma.ts` builds the `PrismaClient` from a `pg.Pool` wrapped in `@prisma/adapter-pg` (Prisma 7 no longer accepts a bare `datasourceUrl`), cached on `globalThis` across dev hot-reloads. Use this singleton (`import { prisma } from "@/lib/prisma"`) — never instantiate `PrismaClient` directly.

Key `schema.prisma` models and how they relate:
- `CardSet` — a product release (e.g. a specific year/brand of cards), with `category`/`subCategory` and set-level totals (`totalCardsInSet`, `totalHitsInSet`, `totalChaseCardsInSet`).
- `ChecklistCard` — the authoritative per-card entry in a set's checklist (cardNumber, player, team, `cardCategory`, `cardTier`, parallel, printRun). This is what `app/sets/[id]` renders as the master checklist.
- `CardTemplate` — an older/parallel catalog-entry model for a specific card, still referenced by `PortfolioCard`, `CardTemplateLike`, `CardTransfer`, and `UnverifiedHit`. `ChecklistCard` and `CardTemplate` currently coexist and are not the same table — check which one a given query needs.
- `PortfolioCard` — a "gel": a user's owned physical copy of a card, with acquisition method, hit location/date, seller, serial number, and front/back images.
- `RipSession` — a pack/box-opening session tied to a user and optionally a set.
- `CardTransfer` — chain-of-custody record of a card moving between users (or in/out externally).
- `UnverifiedHit`, `CardTemplateLike` — user-submitted hit reports and per-card likes.
- `CardCategory` (BASE/PARALLEL/INSERT/AUTO/RELIC/...) and `CardTier` (rarity/print-run tiers) together replaced an older single `CardType` enum. **That migration is incomplete**: some code still references the removed `CardType` enum or a `parallelType` field that no longer exists on `CardTemplate` (`app/api/sets/[id]/route.ts`, `app/api/sets/[id]/gels/route.ts`, `lib/data/sets.ts`, `prisma/seed.ts`). Check `prisma/schema.prisma` directly rather than assuming a call site is correct.

`prisma/dev.db` is a stale SQLite leftover from an earlier iteration; the current datasource is Postgres-only and this file is unused.

### Auth

NextAuth **v4** (`next-auth@^4`), configured in `app/api/auth/[...nextauth]/route.ts` (exports `authOptions`: Google provider, Prisma adapter, database sessions, custom sign-in page at `/auth/signin`, a `session` callback that injects `user.id`). Root-level `auth.ts` is a thin wrapper (`getServerSession(authOptions)`) so server components can call `await auth()` in the v5 style while the app still runs on v4. `types/next-auth.d.ts` augments the `Session["user"]` type with `id`.

### Request flow: Set Detail page

`app/sets/[id]/page.tsx` (server component) resolves the session, calls `getSetDetail(setId, userId)` in `lib/data/sets.ts` — the central data-access function that fetches the `CardSet`, paginated `ChecklistCard`s, the signed-in user's `PortfolioCard`s for that set, distinct teams/categories, and reshapes it all into one `SetDetailData` payload — then renders `components/set-detail/SetDetailClient.tsx`, which composes `SetHeader`, `YourGels`, `ChecklistTable`, and the `AddGelModal` (opened from either `YourGels` or `ChecklistTable`).

Submitting the Add Gel modal posts to `app/api/sets/[id]/gels/route.ts`, which creates a `PortfolioCard`. Other API routes: `app/api/sets/route.ts` (paginated/filterable set list for the home page grid), `app/api/sets/[id]/checklist/route.ts` (paginated/filterable checklist rows), `app/api/sets/[id]/cards/[templateId]/like/route.ts` (toggle a `CardTemplateLike`).

### Known gaps (relevant when touching this code)

- `ChecklistTable.tsx` renders UI for like counts and a `CardHistoryEvent` chain-of-custody timeline, but `checklist/route.ts` always returns `likeCount: 0` / `cardHistory: []` — the backend for that isn't wired up yet.
- `components/providers/SessionProvider.tsx` is an unused duplicate of `components/Providers.tsx` (the one actually used in `app/layout.tsx`).
- `AddGelModal` stores card photos as base64 data URLs rather than using the already-installed `uploadthing` package.
