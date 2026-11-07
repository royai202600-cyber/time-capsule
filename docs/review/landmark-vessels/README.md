# Vessel catalogue/rewards release

Batch 1 `20261107073919_add_batch1_vessels` is applied to `uzimuygyxwraybsipeij`. Live Shop and Create step 3 show all ten entries. A throwaway account acquired mixtape through the live Shop, and a real time-locked fortune-cookie capsule opened through the hold ritual and displayed its letter.

PR #62: green CI 42361550277 on d660a847, latest-main local TypeScript and 23 tests; owner-account squash 49b5833. GitHub retained contributor authorship, so owner release 1e2134e follows. Vercel rejected it with build-rate-limit. Dashboard confirms production remains 9d0a328.

## Held migration

20261107103039_landmark_vessels_and_rewards adds earned_place FK + unique partial place index, exact requested 30 rows/sort/prices (20 regular + 10 earned), and replaces acquire/send/open without changing existing signatures, ACLs, time/place/voice/prediction guards. Reward insertion is inside the first-opening transaction after server distance/accuracy checks, and ON CONFLICT prevents duplicate ownership. Existing opened capsules are not retroactively rewarded.

`supabase/tests/landmark-vessels.sql` tests all ten acquisition denials, all ten unowned-send denials, successful owned sending, absent/inaccurate/far/early/wrong-recipient opens, all ten rewards, repeat opening, already-owned reward, sender non-reward, sealed contents, direct ownership writes and ordinary free/paid regressions. Preflight combines migration and tests in a hosted transaction ending ROLLBACK. See preflight.json. No pending schema/rows persisted. Run after deployment: `npx supabase db push --remote=uzimuygyxwraybsipeij --skip-vault --dry-run`, inspect only this migration, then the same command with --yes instead of --dry-run.

Cabinet now keeps unearned zero-price landmarks as silhouettes; shared Shop/Create/Cabinet predicates have three unit tests. Shop focus links also respect visibility. Native/web exports, TypeScript, 26 tests and dependency checks pass. Current live type generation matches database.types.ts exactly; final type regeneration and production tests of the 30 rows await deployment + actual schema application.

No billing or hosting settings changed. Expo Go uses `cd mobile && npm start -- --tunnel` (8087); web uses `cd mobile && npm run web` at http://localhost:8088. Roy's physical check is pending. Security advisor baseline contains existing intentional sealed-table/no-policy and callable guarded RPC notices, plus pre-existing rls_auto_enable and leaked-password-protection notices; this change adds no new public RPC.
