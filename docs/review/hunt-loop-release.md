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

The first copies assertion attempted `acquire_vessel('photo-strip')` as a Shop purchase. It failed with HTTP 400, SQL `P0001`, hint `collect_only`, message `vessel must be collected`. This is a test-fixture error: `photo-strip` has neither a brand nor a numbered edition, so the existing acquisition rule correctly refuses it. Read-only catalog inspection confirms `maison` is eligible and finite (brand Maison Aurèle, edition total 300). No production function or odds were changed. Stop was honored; no further gameplay checks ran.

Resume with an eligible finite Shop fixture, then finish copies, racks, all five quest types, Today's Hunt motion/friends/progress, route walks/opening, and admin/Undo checks at 375 px in both languages. Do not reapply migrations or redeploy the existing release merely to rerun tests. Do not mark HL-U1–U5, HL-C1–C5 or HL-Q1 Done until this checklist passes.

## Cleanup

All four disposable accounts were globally signed out, their temporary admin membership removed, and users deleted. Verified zero fixture users, profiles, Auth identities, sessions, refresh tokens, Auth audit entries, friendships, capsules, ownership rows, daily plays, admin memberships and admin actions. No custom pool, route or vessel fixture was created. Automatically initialized city schedules contain production Q1 content, not disposable test content. Temporary credential-bearing harness/session files were deleted. Browser signed out and viewport override reset. Time Capsule Docker containers remain stopped; other projects' containers were untouched.

Local run command: `cd mobile && npm run web`, at http://localhost:8088.
