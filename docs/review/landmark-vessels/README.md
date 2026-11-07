# Vessel catalogue/rewards release

## Current release

Vercel accepted owner-authored PR #64 squash `99e70f530a125e92233694be11aae479d0d325d2` (green CI 42364682380), which contains PR #62. Deployment `Agw85HxUt1LReqbbQ1wYiFwTes5T` reached Ready and showed the production domain before the held migration was applied. Both `20261107073919_add_batch1_vessels` and `20261107103039_landmark_vessels_and_rewards` are now applied to `uzimuygyxwraybsipeij`. The earlier `1e2134e` rate-limit failure did not require settings or billing changes.

Catalogue: 47 total = 7 original + 30 new regular + 10 earned landmarks. database.types.ts regenerated from the actual hosted schema after application.

## Verification

TypeScript, 26 unit tests, Expo dependency check, iOS/web exports and root Vite build pass. All 216 illustrated asset imports exist. Hosted function-body comparison confirms the existing acquire/send/open guards are unchanged apart from the intended earned gates and reward insert.

`supabase/tests/landmark-vessels.sql` tests all ten acquisition/send denials, successful owned sending, absent/inaccurate/far/early/wrong-recipient opens, all ten rewards, repeated/already-owned opens, sender non-reward, sealed contents, direct ownership writes and ordinary free/paid regressions. Preflight combined migration and tests in a hosted transaction ending ROLLBACK; see preflight.json.

`supabase/tests/landmark-vessels-api.mjs` then ran six real public-key/JWT API groups against the applied schema: exact catalogue counts, all ten acquisition/unowned-send denials, failed openings without rewards, all ten successful recipient-only/idempotent rewards, owned/free/paid sends, and direct-table access denials. See api.json. Test coordinates simulate arrival; no real GPS sensor claim.

Live web: all ten batch-1 vessels in Shop and Create; 37 regular vessels and no unowned landmarks in the full Shop; Shop acquisition gives an owned Cabinet close-up; fortune-cookie hold/open animation leads to its letter. Roy confirmed batch-1 Shop/Create/acquisition/Cabinet/free opening in iPhone Expo Go. Remaining-wave physical check was requested.

## Rules and local commands

Rewards are granted only inside the first successful opening transaction, after existing server time/distance/accuracy checks. Existing already-opened capsules are not retroactively rewarded. ON CONFLICT prevents duplicate ownership. Cabinet uses the same earned-access predicates as Shop/Create, and Shop focus links respect visibility.

Expo Go: `cd mobile && npm start -- --tunnel` (8087). Web: `cd mobile && npm run web`, http://localhost:8088. No billing/hosting/auth settings changes. Security advisor baseline has intentional sealed-table/no-policy and guarded-RPC notices, plus pre-existing rls_auto_enable/leaked-password-protection notices; no new public RPC was added.
