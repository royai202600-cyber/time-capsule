# Combined hunt-loop release — production validation stopped

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
