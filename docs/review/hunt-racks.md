# Waypost rack data move review

**Contract additions.** Rack items also return `lock_question` so the client can display the prompt. Validation also returns `bad_filter` for an unknown filter and `rejected` for malformed text input. All requested RPC names, fields and error codes are present.

## RPCs

| RPC | Result and behavior |
|---|---|
| `waypost_rack(waypost_id, filter, cursor)` | `{ count, items, next_cursor }`. The count is the entire matching set and pages contain up to 24 items. Pass `next_cursor` back unchanged with the same Waypost and filter. Item fields are `capsule_id, sender: {portrait, name}, hint, opens_at, ready, has_question, lock_question, is_friend, is_mine`. Ready means the timer has elapsed. |
| `rack_leave(waypost_id, lat, lng, accuracy, body, hint, wait_days, lock_question?, lock_answer?)` | `{ capsule_id, opens_at }`. Errors are `too_far` for ineligible Wayposts, bad accuracy or distance over 100 m, `bad_wait`, `blocked_words`, `no_answer` and `rejected`. Body is 1–280 characters, hint up to 40, question and answer up to 280 each. The database always picks the bottle and does not read or change ownership. |
| `rack_open(capsule_id, lat, lng, accuracy, answer?)` | Content object with the same fields as an `open_capsule` row. Checks rack availability, including sender exclusion, then location, time and answer. Errors are `taken`, `too_far`, `too_early` and `wrong_answer`. The answer uses lowercasing and removal of whitespace, including ideographic spaces. |
| `admin_waypost_rack(waypost_id, cursor)` | Pages with sender, hint, opens_at, lock_question, status and report_count. Hidden Wayposts and capsule history are available to staff. Reported entries show the body to owner, admin and moderator. Viewer sees metadata. A read is audited only when its page shows a reported body. Errors are `forbidden` and `not_found`. |
| `admin_rack_remove(capsule_id, reason)` | Owner, admin and moderator. Returns `{ action_id, capsule_id }`. Errors are `forbidden`, `not_found` and `reason_required`. Removal revokes Inbox access if claimed. Pass `action_id` to `admin_undo` for an unopened removal. Undo refuses stale actions and opened capsules. |

The shared `private.text_allowed(text)` checks English and Chinese substrings case-insensitively. Database writers can reuse it for routes and private letters. The word table, helper and sealed answer all have restricted access.

## Replaced behavior

- `public_capsule_report` and its existing `sea_report` wrapper use the existing report table. The first pending report hides an unclaimed rack entry globally. Reports after opening leave the claim in place while staff review it.
- `private.public_capsule_is_hidden`, `admin_queue` and `admin_queue_resolve` surface pending reports and the question in the existing queue. Restore makes an unopened entry available unless an independent rack removal is in force. Remove revokes Inbox access and retains the opening record.
- `admin_undo` handles rack removal and delegates other actions to the existing game admin logic with its existing permissions.
- `public_capsule_drop` and `sea_throw` accept the old parameters. The old duration becomes a wait at the nearest eligible rack within 100 m. Missing a rack returns `no_shore`.
- `public_capsule_nearby` and `sea_nearby` return empty lists. `public_capsule_pick_up`, `sea_pick_up`, `public_capsule_return` and `sea_return` refuse with `not_allowed`.
- The old point lookup view is retired after the data move. The historical drop-place table and its rows are retained for the later cleanup.

## Proposed cutover

Read-only hosted inventory refreshed on 2026-11-18. **14 unopened capsules move, four are deleted with their content, and one claimed capsule stays in its Inbox.** Three moved capsules are converted to the public bottle. Distances are to the nearest visible, game-enabled common Waypost. Ties use Waypost ID.

Reproduce the snapshot with the query below. The point-type predicates distinguish the three existing location sources; the final distance comparison must use the unrounded value.

```sql
select c.id, c.recipient is not null as claimed, c.vessel,
       n.id as waypost, n.name_en, round(n.distance::numeric, 1) as distance_m,
       case when c.recipient is not null or c.opened_at is not null then 'keep'
            when n.distance <= 1000 then 'move' else 'delete' end as disposition
from public.capsules c
left join private.public_capsule_points s
  on s.id = coalesce(c.public_capsule_spot, c.corrupted_drop_spot, c.public_capsule_drop_place)
  and s.corrupted = (c.corrupted_drop_spot is not null)
  and s.drop_place = (c.public_capsule_drop_place is not null)
left join lateral (
  select w.id, w.name_en, public.distance_m(s.lat, s.lng, w.lat, w.lng) as distance
  from public.public_capsule_spots w
  where w.game_enabled and w.hidden_at is null and w.kind = 'common'
  order by public.distance_m(s.lat, s.lng, w.lat, w.lng), w.id
  limit 1
) n on true
where c.is_public
order by disposition, c.id;
```

| Capsule ID | Disposition | Nearest Waypost (ID) | Distance (m) | Existing state / vessel |
|---|---|---|---:|---|
| 250ea8a0-f5ae-44a7-b4af-24f8141d70f0 | delete | Square (e346c227-0647-4b31-99a3-2c6baa5b3bed) | 1718629.3 | unclaimed / bottle |
| 30165305-cf5b-4428-87c8-340ac88fa991 | delete | Dahu Park (7aba1ead-3282-4114-8f01-298b27b8d2c0) | 1478695.7 | unclaimed / bottle |
| 4b9bd4a7-5e35-4f30-ba73-736f6917c15c | delete | Watten Heights Playground (f19a5775-f92c-454b-bf87-e17c1245e54e) | 1428789.8 | unclaimed / bottle |
| 571a08ba-949d-43b6-a3f7-277b269b3b2c | delete | Dahu Park (7aba1ead-3282-4114-8f01-298b27b8d2c0) | 1747802.7 | unclaimed / bottle |
| 8e5a2810-27a3-450e-a5dc-4c33775b787f | keep | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | claimed / bottle |
| 04c53bde-a0db-4898-8b19-b3b6912c82e2 | move | The Lawn @ Marina Bay (a8c3458a-5114-4069-bfb4-209d06ca2349) | 0.0 | unclaimed / bottle |
| 19f78c9d-a189-4b4f-af1c-c2fa480f24a6 | move | Taipa Central Park (d443af61-f899-4fd3-8682-d81d018e1e01) | 0.0 | unclaimed / bottle |
| 20303ff0-c28b-4478-9b6d-e4d8605bf86a | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / bottle |
| 2877612a-0c14-4984-9c4f-bfa2bb6eb978 | move | Zhongshan Park (2320d485-96e2-4d48-a50b-40ea857f66d3) | 0.0 | unclaimed / bottle |
| 2e382c01-5665-490e-ade4-1e1a1d1e1266 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / hourglass |
| 38bee92f-8f25-4a64-83ee-57e2d7c064b2 | move | Esplanade Park (ce9e7682-41fc-4c55-840f-3445907c33f7) | 0.0 | unclaimed / bottle |
| 3fa3016e-b155-4869-9154-2e10ad8d7363 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / dome |
| 52a2e946-53b2-4da0-b3d4-0297ebfb8938 | move | 228 Peace Park (172388c5-9d3d-4ac1-af6a-fd94f34b73bb) | 0.0 | unclaimed / bottle |
| 98eae765-99eb-49fa-840e-52b5bb6ea6e6 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / envelope |
| bbdfbeaf-c192-4a8f-9880-d8f008ea3c11 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 67.7 | unclaimed / bottle |
| cac905d1-7ecc-43ee-ba45-d6e0ef2f9db1 | move | Zhongshan Park (2320d485-96e2-4d48-a50b-40ea857f66d3) | 0.0 | unclaimed / bottle |
| dc41325b-d93a-49a2-80ef-ed077b05c2f2 | move | Xinyi Square (cff0ab16-af6b-4e57-bcde-0d0e9075ce8e) | 0.0 | unclaimed / bottle |
| df4f3d12-9f18-4b47-9e59-ad1be7e7f20f | move | Songshou Square (dfa83121-4233-4e14-8f64-45bfe84b3256) | 0.0 | unclaimed / bottle |
| fa2e095d-ac0d-47a3-9720-92302535dff2 | move | Taipei Civic Square (e736802f-8192-42d8-ae36-58caa815e005) | 31.7 | unclaimed / bottle |

## Verification

- Hosted Supabase ran the migration and `supabase/tests/hunt-racks.sql` inside one transaction ending in `ROLLBACK`. It checked legacy and rack RPC errors, paging and filters, sealing, report and queue states, staff roles, audit records, grants, and the 19 dispositions including the four content cascades. A follow-up read confirmed 19 original public capsules, zero fixture accounts, Wayposts and audit rows, and neither the new RPC nor the migration version present.
- Local Supabase ran the SQL suite and `node supabase/tests/hunt-racks-api.mjs` with disposable real JWTs. Both HTTP open requests were observed waiting on the same PostgreSQL row before the lock was released. The winner received the letter and Inbox row, and the other got `taken`. True concurrent access was tested locally because independent hosted sessions cannot see schema changes inside the rollback transaction.
- Local cleanup confirmed zero disposable users, sessions, capsules and content rows. The temporary schema changes were reverted, the Time Capsule containers stopped, and the preserved volume was kept.
