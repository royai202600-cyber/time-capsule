# Batch 1 catalogue and PR #49

## Current state

The migration `20261107073919_add_batch1_vessels.sql` is prepared, not applied. It passed a hosted transaction/rollback preflight; the CLI dry run lists only this migration. Hosted `public.vessels` still contains seven rows and no batch-1 rows. No existing data, RPC, grants, auth or hosting settings changed.

The insert adds only the requested ten catalogue rows, no editions or brands:

| id | price_mop | sort |
|---|---:|---:|
| mixtape | 18 | 8 |
| instant-camera | 22 | 9 |
| ramen | 12 | 10 |
| fortune-cookie | 0 | 11 |
| red-packet | 0 | 12 |
| snow-globe | 28 | 13 |
| phone-booth | 22 | 14 |
| firefly-jar | 20 | 15 |
| hourglass | 0 | 16 |
| gashapon | 0 | 17 |

Existing `acquire_vessel` inserts ownership without charging for nonzero-price vessels, and zero-price vessels are usable without acquisition. No payment code or price override is added.

## Required release order — Roy's decision

The old production Shop and Create map every catalogue row into a Vessel, but their installed art manifest supports only seven ids. Publishing these rows first would cause unknown-art errors. Roy explicitly chose to merge the wiring now and defer both the database insert and full device checks.

1. Once Vercel's daily limit resets, deploy the next combined release, including PR #49.
2. Confirm the deployed version actually contains all ten vessel specs and names.
3. Only then, from the release checkout, run:

   ```sh
   npx supabase db push --remote=uzimuygyxwraybsipeij --skip-vault --dry-run
   npx supabase --yes db push --remote=uzimuygyxwraybsipeij --skip-vault
   ```

   Check any other pending migrations before the actual push.
4. Verify exactly 17 catalogue rows, all requested prices/sort values, null brand/edition, and the original seven unchanged.
5. On web (localhost:8088 and production) and iPhone Expo Go (8087), check all ten in Shop and Create step 3, free-vessel self-send/open with animation, and Cabinet placement/close-up. Keep Cabinet shelf vessels still and its native close-up spin fix.

## Checks completed before merge

- Supabase CLI 3.0.0 command help, current migration docs and CLI v3 changelog reviewed. Explicit remote target used; no config push.
- Hosted transaction/rollback insert and catalogue assertions passed. The dry run lists only the pending batch-1 migration.
- PR #49 review: 17 vessel types/specs, ten bilingual names/descriptions, original SVG fallback restricted to its seven valid kinds, keyframe interpolation from the default and closed idle-layer positions. No Cabinet/Create screen changes overwrite PR #48.
- Local TypeScript, 23 tests and iOS export passed. Full new-catalogue flows and phone checks are deliberately deferred until rows can be safely published.

## Original-vessel regression audit

The shared sampler change exposed an implicit Maison ring opacity before the first 0.22 key. Its explicit closed key now preserves the original 0.85 opacity. Comparing the old renderer/data against the new renderer/data at eight opening positions matched all 2,240 property samples for the original seven vessels. All 17 specs and bilingual catalogue entries are present, expected new prices match, and all 107 referenced art assets resolve. Results: `manifest-audit.json`.
