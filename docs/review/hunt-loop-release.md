# Combined hunt-loop release — production validation stopped

## PR #171 review stop — new entry loses its ID in the open form

Reviewed head `c11fc021523054ba48605d4be1d8ee7a4bdecd82`; CI `44479588961` is green and GitHub reports mergeable. The `PoolResult`/`mergePoolEntry` change fixes the missing `uses` shape for the card and open sheet, preserving an existing usage list.

A local deterministic reproduction extracted the actual `PoolSheet` hook initialization, payload construction and save handler from this head. A hook-state harness preserved state across the same mounted component, supplied a server-assigned ID on the first save, then edited the prompt and saved again. The second request still omitted `id` and `answer`. This is a client payload reproduction, not a hosted test. Q1's real server definition confirms the outcome: missing `id` selects the insert path, and a new choice without an answer raises `bad_rule`. If the admin selects an answer again, that same missing ID can create another draft instead of editing the first.

Cause: `PoolSheet` initializes `f` from `entry` only once (`useState` initializer). Saving changes the parent's `entry` prop from null to the returned row, but the sheet remains mounted and `f` retains no ID. The save payload comes from `f`; `setAnswer(undefined)` clears the answer after the first save. This pre-existing form-state issue becomes reachable once #171 prevents the original crash.

Claude follow-up: ensure subsequent saves use the persisted entry ID (or deliberately reinitialize/remount the form on new → saved identity transition). Cover create → save → edit → save without closing the sheet for both choice and price, and assert one row, unchanged identity, and retained answer/amount when those fields are left blank. Re-entering an answer must also update that same row. Keep the usage-preservation tests.

The list also derives `needs_recheck`, which mutation rows omit; `PoolResult` still declares it required and the new merge retains the old value after changing `checked_on`. Align that shape and refresh/recompute the indicator when its source changes so the sample does not mask this difference.

Per Roy's stop-on-failure instruction, #171 was not merged or deployed. No production test, fixture, database mutation, migration, art or screen change was made on this resume. Main remains `e80d0a7`; the previous zero-fixture cleanup and completed Memory Route checks remain valid. Admin acceptance, remaining City Hunt checks and Done/status-doc merge remain pending. Macau remains outside this task.

## Previous production resume — Memory Route passed; admin save crash

PR #170 head `3533590ee4e1fff328bb8a9ff4f41494ad44fc36` passed review, TypeScript, 249 tests (9 sample-only skips), CI `44474755813`, and a fresh web export. The delayed-response reproduction using the actual RouteBuilder functions kept Catch at the home place. Roy's account squash-merged #170 as `6753dc0e0035267afd1f9d3b7846bdf0444e2232`; the identical tree was released in owner-authored `e80d0a7b994212c8b8af673176b7c158cb8cbb63`. Vercel deployment `F2k6RysxYuh6oMa1tKVYPhNTVMNm` reports success. Production common/entry bundle hashes match the export (`__common-894f4221433d8188254e1e49c0d0b2c0.js`, `entry-c2e68e6cf3439d65dbad704b7894d472.js`). This is the current live version at https://time-capsule-pi-two.vercel.app.

Production at 375 × 812, with disposable accounts:

- Memory Route in English: hand-picked Civic Square-area home → Question stayed home → City questions moved to Rainbow Starting Line → Write my own restored home. Catch, Landmark and Arrive also restored/kept home. Sent a personal Question route to Future me, answered at the original location, observed 1/1 completion and held to open the exact test letter.
- Traditional Chinese repeated the editor flow and sent an Arrive Memory Route, completed it and opened its Chinese test letter. A browser-only 3-second delay on `route_pool_pick` reproduced Price → Catch; after the delayed reply the stop remained Catch at the original home. The delay wrapper was removed. Walking used simulated coordinates; only the two disposable capsule opening times were advanced.
- Chinese City Hunt: joined Taipei and agreed with the Keeper, observed five blue numbered pins and sequential locks. Completed the first Arrive; its done state and the next unlocked pin were verified. English Keeper/pin acceptance was already recorded in the prior resume. Full five-type completion remains pending. The temporary player's speed allowance was removed during cleanup.
- Admin question-pool cards displayed the outside-map pill in Chinese. Adding a new choice question through the production UI succeeded as a draft with `outside_coverage=false`, but crashed the page immediately afterward.

**Stop: admin pool save response is not a complete PoolEntry.** Browser error: `TypeError: Cannot read properties of undefined (reading 'length')`, in `QuestionPool` (production `hunts-65a052db35ec1e4263446928c1066869.js`). Reproduce: `/admin/hunts` → Taipei → Add → enter bilingual place/prompt/two choices, select the answer → Save. The draft persists, but the app becomes blank. Location may be left empty for a draft; this is unrelated to the failure.

`mobile/src/features/admin/QuestionPool.tsx:41–43` inserts the mutation response directly into the list, and line 61 reads `e.uses.length`. The list RPC adds `uses` and derived metadata; `admin_question_pool_save` returns `to_jsonb(saved)` without `uses` (Q1 line 86). The service incorrectly types both shapes as `PoolEntry`. Status mutation also returns a plain row. Claude should reconcile mutation responses with the list shape (for example, reload the authoritative list after mutations), preserve accurate usage/derived metadata for edits, and test save/edit/status with the real response shape. Do not merely fabricate an empty usage list for an existing used question. No screen or migration body was changed by Codex.

Per Roy's stop instruction, no further acceptance actions were attempted. Pending: admin price draft, publish/edit/Undo (including Q1 outside-coverage preservation), hidden-reason/bilingual checks, copies settings, player adjustment, rack moderation, calendar, and remaining five-type City Hunt checks including third price miss = 0. Done/status-doc merge stays held.

Cleanup verified: zero temporary Auth users/identities/sessions/refresh tokens/audit entries, profiles, capsules and route stops, ownership/game/hunt/located-progress rows, admin memberships/actions/secrets and speed allowances. The single draft was deleted; pool count returned to 220. Its one audit action was removed in a transaction with the append-only trigger restored and verified enabled. No existing pool row, calendar, vessel, game setting or production odds was edited. Browser signed out; viewport reset; full navigation cleared simulated GPS; credential-bearing helper files removed. Time Capsule Docker remains stopped. Macau `20261119000708` remains absent; no migration ran. Live types still match main.

## Prior resume history

Rack follow-up release `dde7aaf7118b0a153d7868bbfc84d4e226971736` is live at https://time-capsule-pi-two.vercel.app. Vercel reports success for deployment `Aqtq8FMsK3M6GXDerNEts5zrXGzR`; its production entry and common JavaScript bundle hashes match the verified web export (`entry-5c9d685f64a97ed6829e861fd60a4cf3.js`, `__common-600764e1d077e9d748f72cf9bcd29e2e.js`). PR #169 merged through Roy's account as `c3e25f5`; GitHub retained the fork author on that squash, so the identical tree was released in Roy-authored `dde7aaf`. The initial combined release was `62b1028`. Approved art and migration bodies are unchanged.

## Merges and verification

| PR | Squash | Deployment |
| --- | --- | --- |
| #157 | `2fa8151` | held |
| #158 | `05bb0b6` | held |
| #163 | `7bdb6d7` | held |
| #165 | `fb0b13a` | held |
| #167 | `cec8fa2` | held |
| #168 | `62b1028` | initial combined release |
| #169 | `c3e25f5` | rack filters/paging; owner release `dde7aaf` |

#165 and #167 needed the authorized ancestry refresh after the preceding squash. Every file touched by the preceding squash matched its PR head; branch-side conflict resolutions preserved both complete trees byte-for-byte. Local tsc/Vitest passed, then CI passed on refreshed heads `b1e802f` (238 pass / 1 skip) and `2d8faf0` (248 pass / 1 skip).

Release tree `961067e` exactly matched tested `4523a49`. Six backend switches are true, including admin hunt-loop; existing `ADMIN_BACKEND` remains true. TypeScript passed, Vitest passed 240 with 9 expected sample-only skips, Expo dependencies were aligned, and web/iOS exports passed. CI 44460665508 passed. Live type generation changed only conditional-type helper parentheses and the ending newline; owner commit `8cf3a2a` passed TypeScript and CI 44461633235 before the final squash.

The previously completed full hosted rollback and local real-JWT checks remain valid: no migration or application behavior changed on this resume. Claude approved Q1 fix `9300527`; seed JSON remains byte-identical. Route test determinism changes are test-only.

## Applied database versions

The hosted CLI dry-run listed exactly these eight migrations, and the hosted CLI push applied them in this order:

1. `20261118123808` — vessel copies
2. `20261118124925` — hunt racks
3. `20261118125002` — question pool
4. `20261118125330` — shared quests
5. `20261118130332` — City Hunt quest locations
6. `20261118134846` — Today's Hunt
7. `20261118135059` — route capsules
8. `20261118141225` — Q1 pool data and approved admin-save fix

The scoped migration directory copied all repository migrations except Macau `20261119000708`; every copied body matched the release branch. Commands used `supabase db push --remote=uzimuygyxwraybsipeij --include-all --skip-vault`, first with `--dry-run`, then with `--yes`. Singapore `20261118140304` was already applied and was not reapplied. Macau remains unapplied.

Immediately before cutover, rack inventory still showed 14 move, 4 delete and 1 keep. After application there were 15 public capsules. The live pool has 55 rows per city (220 total); the approved Q1 admin-save line is present.

## Production checks and current stop

The earlier `photo-strip` Shop assertion is a passing negative check (`collect_only`). The subsequent Maison check passed purchase at 10 copies, one send leaving 9, and retention at ×0 in Cabinet/Album with Create and the send RPC refusing it. Cabinet/Album/Create were checked at 375 px in zh/en. Those fixtures were cleaned before this resume.

PR #169 at `86f1421bd535623d26a202c27fa53ca6536f8b5c` resolved the prior missing-filter and page-boundary stops. CI `44467523999` succeeded. Local `npm exec -- tsc --noEmit`, `npm exec -- vitest run` (244 passed, 9 expected skips) and `npx expo export --platform web --output-dir /tmp/tc-hl-rack-export` passed. The mobile tree matched main after squash; live types still match `8cf3a2a` exactly.

Four fresh disposable accounts used real hosted GoTrue JWTs. Production browser checks used 375 × 812 and simulated location, not a physical walk:

- **Racks:** all six chips in zh/en matched API counts and contents. Before claiming: All 29, Ready 28, Waiting 1, Question 26, Friends 26, Mine 0. Question loaded 24 items, then 2; browser navigation passed 24 → 25 → 26 → 1, with Back from the first staying put before all pages loaded. English repeated the boundary after a claim (24 → 25 of 25). Mine kept the empty rack card open. Create sealed one question-locked and one unlocked public capsule. A wrong answer was refused; the correct answer displayed the letter, assigned the first reader, and a second reader got `taken`.
- **Today's Hunt:** each city displayed three quest pins. Taipei completed question, price and all three catches for 30 points; Hong Kong, Macau and Singapore exercised incomplete-catch completion for 22 points. All paid the once-only 3 wax balls, ending at 42 from 30. Completed pins displayed purple with ticks. Speed up showed ×4; Macau and Singapore ran with emulated Reduce Motion. All four completed summaries were checked in zh/en. Taipei's friends board showed the player at 30 and the disposable friend at 10.
- **City Hunt:** joined Taipei, met the Keeper and selected Let's go. The 60-minute timer began and five blue numbered pins appeared (three Arrive, Catch, Landmark). The remaining pins were locked in sequence. This English check passed; the full bilingual five-type City Hunt checklist remains incomplete.
- **Friend route:** sent through the real RPC from the disposable friend, received its one brass Arrive stop, completed it through the production map, observed the checklist change to 1 of 1, and held to open the letter. Only this fixture's opening time was advanced for the test.

**Current stop: Memory Route loses the user's selected place when adding their own question.** Reproduction at 375 px in English:

1. Create → Future me → Walk a route → Tap your own places on the map.
2. Use the selected Civic Square-area spot, labelled `府前停車場 (行人出口)`. It starts as Arrive.
3. Choose Question. The stop changes to `Rainbow Starting Line` and its pool question.
4. Choose Write my own. The free-text question fields appear, but the replacement place remains.

`mobile/src/features/create/RouteBuilder.tsx:59` automatically calls the pool picker on a change to Question. Line 50 overwrites the chosen coordinates and both names with the pool location. Lines 105–107 switch to a personal question without restoring the chosen place. There is no control to reposition that existing stop. This prevents the own-place/own-question Memory Route described in `docs/design/hunt-loop.md:59` and `:61`. Claude should preserve the manually selected place for a personal question and make a move to a pool location explicit. No screen fix was made by Codex, and the Memory Route draft was not sent.

Stop-on-failure was honored. Pending: repaired Memory Route send/walk/open, remaining bilingual City Hunt/five-type checks (including third price miss = 0 points), and the full production admin checklist (pool create/publish/edit/Undo, outside-map/hidden metadata, copies settings, player adjustment, rack moderation and calendar). HL-U1–U5, HL-C1–C5 and HL-Q1 are not marked Done, and the status docs remain unmerged. No migration was reapplied; Macau remains excluded.

## Earlier stops (resolved)

The missing rack controls were recorded in `9f6186c`, and the old modulo page-boundary bug in `54e4feb`. Both are fixed and production-verified by #169. The initial Shop-fixture correction was recorded in `02ceed3`.

## PR #170 review stop

Reviewed head `c887608735f0f8de9de84657c89cdc7bd7fb24fc`; CI `44472236346` passed. The new home-place helpers address the normal sequential Memory Route flow, and `stopForSend` excludes the editor-only home field.

A delayed-response reproduction using the PR's actual `homePlace`, `retypeStop`, `update`, `another` and `retype` functions found a remaining race: from a hand-placed Arrive stop, choose Price (pool request pending), then Catch. Catch correctly restores the home place, but when the older pool request resolves, `another` unconditionally calls `update` and changes the stop back to Price at the pool location. Type chips remain available during that request. This async path predates the PR, but still defeats the required place restoration under normal network latency.

Claude follow-up: track and invalidate pending requests per stop on subsequent type/place/source changes or removal; only a response for the current intent may update the stop. Add a delayed-response regression covering Price → Catch (and a pool request superseded by a personal question). The four helper tests do not cover the asynchronous component path.

Per Roy's stop instruction, #170 remains unmerged. No production changes, fixtures or browser tests were performed on this resume. The prior cleanup remains intact. Memory Route production checks, remaining City Hunt/admin acceptance and Done/status-doc merge are still pending. Macau was untouched.

## Cleanup

All four accounts were globally signed out and deleted, along with their temporary admin membership and 31 disposable capsules. Verified zero fixture users, profiles, Auth identities, sessions, refresh tokens, Auth audit entries, friendships, capsules, ownership rows, daily plays, game-player rows, City Hunt progress, admin memberships and admin actions. Friend-route stops and content were also zero. No custom pool, vessel, calendar edit or game setting was created; calendar reads only initialized legitimate production schedules. No audit-trigger override was needed on this resume.

The unsent Memory Route draft was discarded. Credential-bearing harness/session files were deleted. Browser signed out; viewport and Reduce Motion overrides reset; navigation cleared the simulated geolocation. Time Capsule Docker containers remain stopped, and other projects' containers were untouched. Macau `20261119000708` was verified absent after cleanup.

Local run command: `cd mobile && npm run web`, at http://localhost:8088.
