# HL-C2 vessel copies

Migration `20261118123808_vessel_copies.sql` is held for Claude’s review and Roy’s approval. Existing finite ownership starts at 10. A successful private send spends one copy and keeps the collection entry at zero. Starter and earned Landmark vessels have unlimited copies. Public rack capsules are produced by HL-C1 with the unlimited `bottle` and bypass the private send RPC.

A successful Corrupted Capsule catch adds `copies_per_catch`, currently 3. `private.award_catch_copies` is called only when a catch should award inventory. Today’s Hunt can pay points on its own path. `private.copies_per_catch` is the point for a later level bonus. Unlimited catches can establish ownership and leave the balance null.

## Client and admin contracts

| Interface | Payload or behavior |
|---|---|
| `my_collection()` | Keeps `vessel`, `copies`, `stars`, `edition_no`, `acquired_at`. Album and Cabinet get nullable `copies`. `stars` is 1 for a collected vessel regardless of duplicates. |
| `vessel_stock()` | Keeps `vessel` and global limited edition `remaining`. Adds the caller’s `copies` for those rows, 0 when a finite vessel is unowned and null when unlimited. |
| `owned_vessels` and `vessels` | Album, Cabinet and Create step 3 read these tables. `owned_vessels.copies` is nullable and zero is retained. `vessels.unlimited_copies` includes the implicitly available starters, which need no owned row. |
| `send_capsule(...)` | Both existing signatures still return the capsule ID. An owned finite vessel at zero raises `no_copies` as the message and hint. |
| `corrupted_capsule_throw`, `corrupted_throw`, `landmark_hit` | Keep response columns including `copies` and `stars`. Restored or won results report 1 star and nullable `copies`. `corrupted_throw` delegates to the updated RPC. |
| `admin_spawning()` | Adds `config.copies_per_catch` and `rules[].unlimited_copies`. |
| `admin_wave_config_set(p_copies_per_catch, p_note?)` | Adds an overload of the existing game settings write path. The original wave settings signature remains available. The new overload accepts 1–1000, returns `{copies_per_catch}` and logs the edit. |
| `admin_vessel_set_unlimited(vessel_id, on)` | Returns `{unlimited_copies}`. Switching on clears displayed balances, switching off starts at zero. Undo restores the recorded balances if the snapshot still matches. Starters and earned Landmark vessels always remain unlimited. |
| `admin_player_adjust_copies(user_id, vessel_id, delta, reason)` | Returns `{copies}` for an existing finite ownership row. Requires a reason and rejects negative resulting balances. Undo checks that the balance still matches. |
| `admin_undo(p_action_id, p_note?)` | Reverses the switch, player adjustment and copies setting and appends an Undo action. An intervening change can make the original action stale. |

The admin copy writes require owner or admin. The copies setting is stored separately from the spawn configuration because spawn revisions persist the latter as a composite type. No admin or player screen wiring is included in this backend package.

## Existing functions replaced

- `public.send_capsule(uuid,text,text,text,timestamptz,text,text,text,text,integer,text,text)` from `20261109023618`. The point overload from `20261113190556` calls it and is unchanged.
- `public.corrupted_capsule_throw(text,double precision,double precision,double precision,text,double precision,boolean)` from `20261115153118`. The compatibility wrapper remains in place.
- `public.landmark_hit(uuid,double precision,double precision,double precision,text,double precision)` from `20261114080044`.
- `public.my_collection()` from `20261108180337`.
- `public.vessel_stock()` from `20261106140000`. Recreated to add a result column.
- `public.admin_spawning()` and `public.admin_undo(bigint,text)` from `20261115153118`.

PR base is main after #151. If HL-C1 or HL-C3 lands before HL-C2, compare all function definitions above, rebuild any overlapping replacements from the merged definitions and rerun the rollback checks. In the combined release, verify the rack inserts the unlimited bottle and the catch and Landmark actions still credit the applicable quests.

## Validation and release checks

- Hosted SQL ran the migration body followed by `supabase/tests/vessel-copies.sql`, in one transaction ending in rollback. Checked backfill, both send overloads, zero balance, all four starters, the legacy public bottle drop, an actual Landmark win, a real spawn catch with odds set to 100% inside the transaction, duplicate inventory awards, admin roles, audit and Undo. Hosted follow-up found no fixture accounts or copy settings table.
- `python3 supabase/tests/vessel-copies-concurrent.py vessel_copies_test` used five authenticated PostgreSQL sessions against a disposable local database. All five waited at the same balance lock. Two committed complete capsules and three returned `no_copies`. The ownership row remained at zero. The scratch database was dropped and the database container started for this check was stopped. The shared local volume was preserved.
- In `mobile`, `npm run typecheck` and `npm test` passed (212 tests). `npm run web` at [localhost:8088](http://localhost:8088) rendered sign-in in Traditional Chinese and English. This browser smoke check used the current hosted backend.
- After approval and migration application, sign in with disposable accounts using the public-key Auth API and repeat the five-send race, a catch, zero-balance collection and refusal, starter and Landmark unlimited sends, both legacy send payloads, and owner/admin/ordinary-user checks. Verify the API returns null and zero as specified, sign out the disposable sessions, delete the accounts, and confirm no test records remain. The local Auth and Data API point at the preserved database and were not redirected to the scratch database.
