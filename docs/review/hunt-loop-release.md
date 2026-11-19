# Combined hunt-loop release — production validation stopped

Release `62b102831501d4e0cdff587ddbccb22abdecf8ca` is live at https://time-capsule-pi-two.vercel.app. Vercel reports success for deployment `A1iKDNHiLNNYyN3qqdA1vNmXK7uS`; the production entry and common JavaScript bundle hashes exactly match the verified web export. The release commit is authored by Roy. Approved art is unchanged.

## Merges and verification

| PR | Squash | Deployment |
| --- | --- | --- |
| #157 | `2fa8151` | held |
| #158 | `05bb0b6` | held |
| #163 | `7bdb6d7` | held |
| #165 | `fb0b13a` | held |
| #167 | `cec8fa2` | held |
| #168 | `62b1028` | released |

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

## Production checks and stop

Four disposable accounts signed in with real hosted GoTrue JWTs and the public API key. Every city returned three Today's Hunt pins in question/price/catch order and three route templates. The browser signed into a disposable account and rendered Home/Me at 375 px in English. This is only a smoke check, not the requested complete bilingual gameplay validation.

The previous `photo-strip` Shop stop was a test-fixture mistake. Roy accepted `collect_only` as a passing negative check and authorized resuming with finite Shop vessel `maison`.

On the production resume, four fresh disposable accounts authenticated with real GoTrue JWTs. At 375 px, the English Shop purchase acquired Maison edition 006 with 10 copies. Cabinet, Album and Create showed ×10; sending a capsule through Create consumed one copy (9 remained). A disposable admin's player adjustment set that ownership to zero. Cabinet and Album retained it at ×0 in Traditional Chinese and English; Create showed ×0 and refused selection with the localized no-copies message. The real send RPC also returned `no_copies`, while `my_collection` retained the ownership. Starter vessels showed unlimited copies.

Rack RPC assertions passed all six filters (`all`, `ready`, `waiting`, `has_question`, `friends`, `mine`) using disposable locked, unlocked and waiting capsules. The zh production Create flow successfully left a public capsule without a question at Taipei Civic Square. Location checks used simulated browser coordinates, not a physical walk.

**New stop: rack filters are missing from the production screen.** At 375 px in zh, opening the Waypost rack displays the capsule card and previous/next pagination, but no rack filter controls. The map filter sheet only selects map categories. `mobile/src/features/journey/JourneyScreen.tsx:398` hardcodes `racks.list(waypost.id, "all", ...)`; lines 629–632 render only the selected card. `mobile/src/services/racks.ts` already defines all six filters. This is a screen integration gap for Claude, not a failing filter RPC. No screen code was changed, and no further gameplay checks ran after this failure.

Pending: filter UI and bilingual rack checks, wrong/right answer and first-opener checks, Today's Hunt motion/friends/progress in every city, Keeper/City Hunt quest pins and five quest types, friend and Memory Route walks/opening, and the remaining admin/Undo checklist. Do not mark HL-U1–U5, HL-C1–C5 or HL-Q1 Done or merge the status docs as completed until these checks pass. Do not reapply migrations. The live-types file on `origin/main` is byte-identical to commit `8cf3a2a` (included through the release squash).

## PR #169 review stop

PR #169 at `201a418b0ab49cbd57a5bd0870d3e93ffa842a21` adds the six localized rack chips, filter-aware fetches, request sequencing and the empty-filter message. Only JourneyScreen and rack strings change. GitHub reports mergeable and CI run `44465361656` succeeded; the connected merge account is Roy's `royai202600-cyber`.

Review stopped before merge because the existing `rackStep` logic at PR lines 418–423 still breaks forward navigation across a server page boundary. It starts `loadRack(..., true)` without awaiting it, then computes the next index modulo the old list length. A Node VM reproduction extracted that exact function body from the PR: with 20 loaded Ready capsules, index 19 and a next cursor, pressing Next loads capsule 21 but selects index 0 (capsule 1). The same arithmetic fails for any page size. The chosen filter is preserved; the selected capsule is wrong. This predates #169 but fails the requested filtered-pagination acceptance check.

Claude follow-up: advance to the first appended capsule only after a successful current-page response; preserve the active filter and request sequencing, and wrap only when no next page exists. Cover the page boundary and a filter change during an in-flight page request. No screen edits were made by Codex. PR #169 remains unmerged, no deployment was triggered, and no production fixtures were created on this resume. All remaining production checks and Done/status-doc merge remain pending; Macau was untouched.

## Cleanup

After the resumed checks, all four disposable accounts were globally signed out, their temporary admin membership removed, and users deleted. Verified zero fixture users, profiles, Auth identities, sessions, refresh tokens, Auth audit entries, friendships, capsules, ownership rows, daily plays, admin memberships and admin actions. The disposable copy-adjustment audit row was removed within a transaction; the append-only audit trigger was re-enabled and verified. Maison ownership returned to its original five rows (295 editions remaining). No custom pool, route or vessel fixture was created. Automatically initialized city schedules contain production Q1 content, not disposable test content. Temporary credential-bearing harness/session files were deleted. Browser signed out and viewport override reset. Time Capsule Docker containers remain stopped; other projects' containers were untouched.

Local run command: `cd mobile && npm run web`, at http://localhost:8088.
