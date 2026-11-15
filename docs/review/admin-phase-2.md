# Admin phase 2 backend

The edit RPCs and existing read RPCs follow the screen contract in PR #145. The backend release leaves `ADMIN_EDIT_BACKEND` off.

- Waypost edits check coverage, 250 m spacing and live City Hunt spin goals. Landmarks remain view-only. An override for a nearby Waypost requires a note.
- Hidden Wayposts and Corrupted Capsule spots remain available for existing capsules that reference them. They leave the new drop and pass-on pool. A hidden Corrupted Capsule spot also stops spawning. The 124,741 independent drop locations are outside the admin map and edit RPCs.
- A spawning edit stages a revision at the next wave. A length change activates at the first future UTC-aligned boundary shared by both lengths. The next wave receives the next unused number. Existing catches retain their IDs and original wave intervals.
- Preview uses the same resolver as gameplay, across all affected cities. It counts every sixth wave over the next 24 hours. The proposed write runs in a subtransaction that rolls back without allocating an audit ID.
- Undo restores the latest audited Waypost, spawning assignment, rule or setting after revalidation. Undoing a Waypost add hides the row and preserves its history. For an effective wave-length change, undo schedules the previous length at a shared boundary. Corrupted Capsule spots use Hide and Show.
- The patch was built against live Supabase definitions after the drop-place migration. The drop and pass-on RPCs still use the same eligibility view. Their bodies needed no changes.

[Diff against live definitions](admin-phase-2-live.diff)

## RPC payloads for the edit screens

- `admin_spawning().places` contains countries and cities with `id`, `parent`, both place and country names, and `has_spots`. A rule's `places` contains direct assignments. Its `regions` contains the cities reached, including inherited assignments. `config.next_length` is null or contains `minutes` and `starts_at`.
- `admin_city_map` Wayposts carry `scene` and `hidden_at`. Corrupted Capsule spots carry `hidden_at`.
- `admin_spawn_rule_set` accepts the exclusive stop hour in `p_end_hour`. The read RPC still sends inclusive display hours. A complete 24-hour selection is stored as an unrestricted window.
- `admin_spawn_preview` accepts `{ call: 'place_add' | 'place_remove' | 'rule' | 'wave', args }` and returns `{ regions: [{ region, before, after }] }` with vessel counts keyed by vessel ID.
- Waypost and spot writes return the saved row. `admin_wave_length_set` returns the effective time. Undo carries the original action ID in its audit row's `after.undo_of` field.

## Ten-minute inventory

| Consumer | Clock used after Phase 2 |
|---|---|
| `private.resolve_spawn` | Resolves a wave number to its permanent time interval and uses the rules effective at its start. Every release expires at that wave's end. |
| `public.game_nearby` | Uses the active wave number and nearby limit from its effective revision. The 30-second Journey refresh stays independent. |
| `public.corrupted_capsule_throw` | Validates the active wave number and resolver expiry. The City Hunt and private-hunt restore bookkeeping receive only accepted catches. |
| `private.refresh_taipei_game_demo` | Uses the active wave number as its batch ID. The resolver recognizes that batch's wave end. The production demo job is dormant. |
| `private.admin_wave`, `admin_city_map`, `admin_cities`, `admin_spawning` | Current pins and out-now counts use the active clock. Catch totals already use `caught_at`, local midnight and the local Monday boundary. They include valid historical catches at hidden spots. |
| Journey and the throw screen | Use the server's `expires_at` for removal and countdown. |
| Admin map and spawning screens | Use the server's `expires_at` for countdowns and `config.wave_minutes` for the label. |
| Development mocks in `game.ts` and `adminSample.ts` | Derive their sample IDs and expiry from their local wave setting. The mock default stays at ten minutes. |

## Verification

Hosted rollback compared 18,156 live spot-and-wave pairs before and after the final migration. All matched. The four-city preview measured 3.17 seconds, above the two-second target. The rollback suite checks permissions, error codes, city guards, hide/show and drop eligibility, pending wave changes, preview rollback, and undo.

Apply the migration and `supabase/tests/admin-phase-two.sql` inside one rollback transaction. Against local Supabase with the migration loaded, run `node supabase/tests/admin-phase-two-api.mjs` with the local test keys. The JWT test waits for a real wave boundary and removes its two disposable users.
