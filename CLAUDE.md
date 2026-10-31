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

**Gel Cards** is a card-collection tracker (sports/TCG/entertainment cards). Users browse official card **sets**, view a set's **checklist** of cards, and log the physical cards they own (**"gels"**) against checklist entries.

### Data layer (Prisma 7, driver-adapter pattern)

`lib/prisma.ts` builds the `PrismaClient` from a `pg.Pool` wrapped in `@prisma/adapter-pg` (Prisma 7 no longer accepts a bare `datasourceUrl`), cached on `globalThis` across dev hot-reloads. Use this singleton (`import { prisma } from "@/lib/prisma"`) — never instantiate `PrismaClient` directly.

Key `schema.prisma` models and how they relate:
- `CardSet` — a product release (e.g. a specific year/brand of cards), with `category`/`subCategory` and set-level totals (`totalCardsInSet`, `totalHitsInSet`, `totalChaseCardsInSet`).
- `ChecklistCard` — the authoritative per-card entry in a set's checklist (cardNumber, player, team, `cardCategory`, `cardTier`, parallel, printRun). This is what `app/sets/[id]` renders as the master checklist. The older `CardTemplate` model it used to coexist with has been fully removed — `PortfolioCard`, `ChecklistCardLike`, `CardTransfer`, and `UnverifiedHit` all relate directly to `ChecklistCard` now via `checklistCardId`.
- `PortfolioCard` — a "gel": a user's owned physical copy of a card, with acquisition method, hit location/date, seller, serial number, and front/back images.
- `RipSession` — a pack/box-opening session tied to a user and optionally a set.
- `CardTransfer` — chain-of-custody record of a card moving between users (or in/out externally).
- `UnverifiedHit`, `ChecklistCardLike` — user-submitted hit reports and per-card likes.
- `CardCategory` (BASE/PARALLEL/INSERT/AUTO/RELIC/...) and `CardTier` (rarity/print-run tiers) are the only card-type enums now — the older single `CardType` enum some code used to still reference has been fully migrated away from.

### Auth

NextAuth **v4** (`next-auth@^4`), configured in `app/api/auth/[...nextauth]/route.ts` (exports `authOptions`: Google provider, Prisma adapter, database sessions, custom sign-in page at `/auth/signin`, a `session` callback that injects `user.id`). Root-level `auth.ts` is a thin wrapper (`getServerSession(authOptions)`) so server components can call `await auth()` in the v5 style while the app still runs on v4. `types/next-auth.d.ts` augments the `Session["user"]` type with `id`.

### Security

`next.config.ts`'s `headers()` sets a CSP (without nonces — `'unsafe-inline'` for scripts/styles, since Next's own hydration needs it without a nonce pipeline) plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` on every route.

`proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`; the exported function is `proxy`, not `middleware` — see `node_modules/next/dist/docs/.../proxy.md`) rate-limits every mutation request (`POST`/`PATCH`/`PUT`/`DELETE`) under `/api/**` to 30/minute per IP — GET requests are never throttled. Backed by `lib/rateLimit.ts`'s `checkRateLimit`, which uses a Postgres fixed-window counter (`RateLimitCounter` in `schema.prisma`) rather than an in-memory Map, so it stays correct across every serverless instance. Proxy defaults to the Node.js runtime in this Next version, so it can use the real `lib/prisma` singleton directly.

### Request flow: Set Detail page

`app/sets/[id]/page.tsx` (server component) resolves the session, calls `getSetDetail(setId, userId)` in `lib/data/sets.ts` — the central data-access function that fetches the `CardSet`, paginated `ChecklistCard`s, the signed-in user's `PortfolioCard`s for that set, distinct teams/categories, and reshapes it all into one `SetDetailData` payload — then renders `components/set-detail/SetDetailClient.tsx`, which composes `SetHeader`, `YourGels`, `ChecklistTable`, and the `AddGelModal` (opened from either `YourGels` or `ChecklistTable`).

`getSetDetail` is internally split into a cached "global" half (`getCachedSetDetail`, `unstable_cache`'d per `setId` — same convention as `lib/data/homepage.ts`, tag `set-detail-<setId>`, 180s safety-net TTL) and a handful of small live per-viewer queries merged on top afterward (`userGels`, `recentPulls`, `checklistRows[].isLikedByUser`, `packsOpened`'s `own*` fields, `userLastGelCity/Country`) — the external signature/return shape is unchanged, so callers don't need to know about the split. The cached half is what actually scans every `ChecklistCard` row in the set to compute the cardNumber grouping (up to ~19,864 rows for the largest set) — identical work for every viewer, which is why it's cacheable. Every mutation that touches a set's checklist/products/metadata (gels, likes, admin edits, product openings) calls `revalidateSetDetailCache(setId)` afterward. `unstable_cache`-backed functions can only run inside a real Next.js request (Server Component render or Route Handler) — calling `getSetDetail` from a standalone script throws `Invariant: incrementalCache missing`.

Submitting the Add Gel modal posts to `app/api/sets/[id]/gels/route.ts`, which creates a `PortfolioCard`. Other API routes: `app/api/sets/route.ts` (paginated/filterable set list for the home page grid), `app/api/sets/[id]/checklist/route.ts` (paginated/filterable checklist rows), `app/api/sets/[id]/cards/[templateId]/like/route.ts` (toggle a `ChecklistCardLike`).

Card front/back images are uploaded directly to UploadThing from the browser (`components/set-detail/AddGelModal.tsx`'s `ImageUploadField`, via `lib/uploadthing.ts`'s `useUploadThing` hook) — the gel-creation API routes only ever receive the resulting URL string, never raw image bytes. This replaced an earlier base64-data-URL approach that worked locally but broke in production: Vercel caps a serverless function's request body at 4.5MB, which a base64-encoded phone photo easily exceeds. The file router lives in `app/api/uploadthing/core.ts` (auth-gated via the session, 16MB max per image) with its route handler in `app/api/uploadthing/route.ts`. Requires `UPLOADTHING_TOKEN` in the environment (the v7+ SDK's single-token format — from the UploadThing dashboard's API Keys page, "V7+" tab — not the older `UPLOADTHING_SECRET`/`UPLOADTHING_APP_ID` pair). Every image in the app (card photos, set banners, profile pictures) renders through `next/image`, not a plain `<img>` — `next.config.ts`'s `images.remotePatterns` allowlists both UploadThing's CDN (`*.ufs.sh`) and Google's profile-picture host (`lh3.googleusercontent.com`).

