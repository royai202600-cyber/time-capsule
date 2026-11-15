# Admin (管理後台)

Status: Roy approved the plan on 2026-11-15. Phase 1 is live (PR #135, migration `20261115111007_admin_phase_one`, release `020ed02`). Phase 2 below is planned and waits for Roy's OK.

Screens: `mobile/app/admin/` routes, `mobile/src/features/admin/` (shell, Overview, Corrupted Capsules, City map, Review, Members, Activity), `mobile/src/services/admin.ts` (types and RPC calls the screens expect). Run `cd mobile && npm run web` and open http://localhost:8088/admin. For local design work, set `ADMIN_BACKEND` to `false`. The sample opens without signing in and has a **View as** switch for each role.

## Why

Roy can't see which cities are open, which Corrupted Capsules are out, or what is on the map, and only Codex can change a Waypost. More people will help later, outside data will come in through OpenDashboard, and capsules need moderation before the App Store. Admin gives the team one place to see and run the game.

## Decisions in this plan

- **Where it lives:** a hidden `/admin` route inside the existing Expo web app (`mobile/app/admin/`), web only. It shares sign-in, the Supabase client, translations and the theme, and needs no second Vercel project. Native builds show nothing at `/admin`.
- **Look:** the Time Capsule look, not a generic dashboard. Cool paper background, Noto Serif TC headings and numbers, Noto Sans TC body, ink blue for controls, brass only for private hunts and precious things such as vessels; Landmarks are blue like the map, wax red for remove/destructive actions, the same cards, pills and portraits as the app. Both languages, switchable.
- **Responsive:** phone first like the app (375 px works for checking a report on the go). From 900 px a left sidebar replaces the bottom tabs, and lists become tables with a detail panel beside them. The map fills the free space.
- **Security is on the server.** Hiding the link doesn't protect anything. Every admin RPC checks the caller's role, and each successful write appends one action log entry. The client only reads `admin_me()` to decide what to show.
- **Three shared parts** that every later feature plugs into: members and roles, the action log, and one review queue.
- **Opening a new city stays with Codex and the SOP** (OSM safety filtering, vessel set, map tiles). Admin shows the result and edits individual Wayposts.

## Roles

| Role | Can |
|---|---|
| Owner | Everything, including members. Roy. At least one owner always remains. |
| Admin | Edit game data, approve imports, moderate. |
| Moderator | Dashboard read access and review queue decisions. |
| Viewer | Read everything except reported letter text. Changes nothing. |

A member is added by the email of an existing app account. Each role is a fixed list of allowed actions on the server (`private.admin_can(action)`), so adding a role later is one line.

## Screens

### Phase 1 (MVP, build now)

1. **Gate.** `/admin` checks `admin_me()`. Not a member: a plain "No access" page with a link home. Signed out: the normal sign-in, then back to `/admin`.
2. **Overview (首頁).** One card per city: Wayposts (common / Landmark), Corrupted Capsule spots, the three vessels that can appear (vessel art), Corrupted Capsules out right now, City Hunts live, private hunts published, map coverage (yes/no and size). A row of review queue counts at the top. Tapping a city opens its map.
3. **City map (城市地圖).** MapLibre with our map style. Layers you can switch: Wayposts (blue gem; Landmarks in our blues), Corrupted Capsule spots, the current wave (vessel picture with minutes left; caught ones faded), City Hunt Keeper and Landmark, private hunt quests (brass teardrop). Tap a pin for a detail card. View only in phase 1.
4. **Corrupted Capsules (破損膠囊).** Which vessels can appear where. Two views of the same rules:
   - **By place:** each country, then its cities (Taiwan → Taipei, Hong Kong, Singapore, Macau today). Each shows its spawnable vessels as art with rarity (common / uncommon / rare), any habitat (park, water, square), hour window and date window, plus how many are out right now and caught today and this week.
   - **By vessel:** every vessel in the catalogue, in Album order, with where it can appear. Vessels that can't appear anywhere sit in their own group, and earned (Landmark) and starter vessels are marked as never spawning.
   - The shared wave settings at the top: wave length (10 minutes), chance a spot shows something, rarity weights, how many appear near a player (6).
   - View only in phase 1; changing them is phase 2.
5. **Review queue (待審).** One list for every kind of item. Phase 1 kinds: reported private hunts and reported public capsules, with report count, reasons, reporters (portraits) and the content. Actions: Restore or Remove, with an optional note. Done items move to a Done tab.
6. **Members (成員).** Owner only. List with portrait, name, email, role, added by and when. Add by email, change role, remove.
7. **Activity (紀錄).** The action log: who, what, when, with before and after. Filter by person and kind. Viewer and up.

### Phase 2: Waypost editing

Owner and admin only; moderators and viewers keep the read-only map. Everything happens on the city map, on phones and desktops alike.

- **Edit mode.** An **Edit Wayposts** button on the map's toolbar. In edit mode the Wayposts layer is always on, and hidden Wayposts show faded with a crossed-out eye so they can be brought back. A thin ink-blue bar at the top says you're editing; **Done** leaves.
- **Add.** Tap **＋ Waypost**, then tap the map. A draft gem drops there and the detail card (side panel on desktop, bottom sheet on phones) asks for:
  - Chinese name and English name, both required. The Chinese name follows the coverage rule: Chinese only, Traditional.
  - Scene, picked from the five scene pictures (park, garden, waterfront, square, public art). This is the picture players see when they spin.
  - A required tick: "I checked this is a public outdoor walkway, not a school, place of worship, hospital, private land or road." The OSM safety filter only runs in the seed script, so this tick is the hand check, and the server stores it with the Waypost (`source_ref = admin:<id>`).
  - Kind is always common. A Landmark Waypost has a monument, a fight and rewards, so it still comes through the Landmark SOP.
- **Move.** Select a Waypost, tap **Move**, tap the new place, **Save**. Tapping is easier than dragging on a phone and never moves a pin by accident.
- **Edit.** Names and scene, from the same card.
- **Hide and show.** **Hide** (wax red) sets `game_enabled = false`. Nothing is ever deleted, so spin history stays. **Show** brings it back. A hidden Waypost leaves the drop and pass-on pool until shown again.
- **Checks, shown in the card before saving:**
  - Closer than 250 m to another Waypost: a warning naming it and the distance. Saving anyway needs a note.
  - Outside the city's map coverage: refused. Beyond the tiles there's no 3D map, so a new area goes through the City Hunt SOP like a new city.
  - Hiding a Waypost inside a live City Hunt area: refused if the hunt would have fewer Wayposts than its spin quest needs; otherwise a warning naming the hunt.
- **Landmarks** show a blue "Landmark" pill and are view only. A Landmark has a monument, a fight, an earned vessel and a Passport stamp, so agents create and change it through the Landmark SOP.
- **When players see it.** At once: Journey reloads nearby Wayposts every 30 seconds.
- Hand-added Wayposts are public capsule drop places like every other safe point (see the drop rule below).
- **Corrupted Capsule spots** show on the map in edit mode with **Hide** and **Show**, for a park closed for construction. Hidden spots leave spawning, drops and pass-on. New spots still come from the seed script, because it does the safety check.

### Phase 2: Corrupted Capsule spawning

Owner and admin only, on the Corrupted Capsules page. Both views get an **Edit** button.

- **By place.** Each place card (Taiwan, then its cities, then Hong Kong, Singapore, Macau) lists its vessels with a remove ×, and **Add vessel** opens a picker of the catalogue in Album order with the art. A vessel added to Taiwan appears in every Taiwan city. Earned (Landmark), starter and brand vessels aren't in the picker.
- **By vessel.** Each vessel's rules: rarity (common, uncommon, rare), habitat (any, park, water, square), hours (any, or from–to local time) and dates (any, or from–to day of year, for festival vessels). **A vessel's rules apply everywhere it appears**, which is how spawning works today; the card says so. A vessel added to a place for the first time starts as common, any habitat, any time.
- **Wave settings** at the top: chance a spot shows a capsule (10–100%), the three rarity weights, and how many appear near a player (1–12).
- **Wave length:** pick 5, 10, 15, 20, 30 or 60 minutes. Uncaught capsules already disappear at the end of each wave, so a change waits for a moment that ends a wave under both lengths and starts there: the next 10-minute mark for 5 minutes, otherwise the next full hour. The card says when ("starts at 15:00"). How long a capsule stays visible follows the wave length. Catches stay safe: each capsule is named by its spot and wave number, and a new length uses numbers never used before.
- **Preview before saving.** Every change opens a preview of the place it touches: out of the next day's capsules there, how many of each vessel would appear, now versus after the change. It's computed on the server with the real spawn rules, so it matches what players will get.
- **Guard.** A place with Corrupted Capsule spots must keep at least one vessel that can appear at any hour and on any date, or its spots would sit empty part of the day. The server refuses the change and says why.
- **When it applies.** From the next wave. Capsules already out stay until their wave ends.

### Phase 2: Undo

Each Waypost and spawning row in Activity gets **Undo**, which puts back the "before" state and is logged too. Undo only works on the newest change to that Waypost, vessel or setting. If something changed since, it says so and you edit it by hand instead.

### Public capsule drop rule (Roy, 2026-11-15)

Separate from admin, and goes first. A dropped public capsule lands on the nearest safe public point **within 100 m** of the sender: a Waypost, a Corrupted Capsule spot or a drop place, all of which passed the seed script's safety check (public paths in parks and squares, away from schools, places of worship, hospitals, roads and private land). That's a 1–2 minute walk, it never shows the sender's exact spot, and the finder is never sent somewhere private. With no safe point within 100 m, the app says to walk to a nearby park or square. This replaces the nearest of a few hand-picked drop places within 3 km.

**Levels:** country → city now. A smaller **area** level (one park, one campus such as HKUST) comes later only if we need it: an area is a drawn shape inside a city whose rules replace the city's rules there. A new country or city still starts through the City Hunt SOP, because it needs Wayposts, capsule spots and map tiles first.

### Phase 3: Data import through OpenDashboard

[OpenDashboard](https://github.com/ispkbinary/opendashboard) (ODB) already brings outside data into datasets and lets a connected app read them with an app key and scopes. Time Capsule becomes one connected app with a read-only `data:read` key.

- Each ODB dataset we use (for example a city's open data on parks or public art) has places with at least: source id, name, coordinates, category, license and attribution.
- A server job (Supabase Edge Function) reads the dataset, on a schedule and from a "Sync now" button. **The key stays in Supabase secrets, never in the browser.**
- Imported places land as **candidates** in the review queue, never straight into the game. An admin approves a candidate into a Waypost, a City Hunt quest location, or a place private hunt organizers can pick from; or rejects it, or marks it a duplicate.
- Every candidate keeps its source and license. OSM data needs credit and keeps its open license; each new source's terms are checked once when it is added.
- A **Sources** page lists each source with its license, last sync, counts (new, approved, rejected) and errors.

### Phase 4: Moderation

"Sealed means sealed" stays: staff never browse private letters.

- **Automatic check on send.** A server function checks text before it is sealed: banned terms in Chinese and English, each marked *block* or *review*. It covers typed letters, hints, profile names, public capsule text, hunt titles and descriptions, and quest text. *Block* returns an error and the sender edits the text. *Review* lets public items through but puts them in the queue; private letters are only ever blocked or allowed, never queued. Admins edit the term list in a **Words** page. An AI check can come later; it only classifies, never writes.
- **Reports.** Recipients can report a private letter after opening it. Only then can a moderator see that one letter, and the viewing itself is logged.
- **People.** Users can block someone. Admins can suspend an account (it can sign in but can't send, drop, create hunts or report).
- **Photos** (private hunt photos, future capsule photos) get an image check later.
- This also covers the App Store rule for user content: filter, report, block, and acting on reports quickly.

## Backend contract for phase 1 (Codex)

Names may change if Codex has a better fit; report the final ones.

- `private.admin_members(user_id uuid primary key references profiles, role text check in ('owner','admin','moderator','viewer'), added_by uuid, added_at timestamptz)`. Seed Roy's account `1fd214ef-4de5-4b4f-81bc-77c3328441fe` as owner. No client grants.
- `private.admin_actions(id bigint identity, actor uuid, action text, target_type text, target_id text, before jsonb, after jsonb, note text, at timestamptz)`. Append only. Every admin write RPC inserts one row in the same transaction.
- `private.admin_can(action text) returns boolean`: role from `auth.uid()`, fixed action list per role.
- `public.admin_me() returns jsonb`: `{ role }` or null. The only admin call a non-member may make.
- Members (owner only): `admin_members_list()`, `admin_member_add(p_email, p_role)`, `admin_member_set_role(p_user, p_role)`, `admin_member_remove(p_user)`. Refuse removing or demoting the last owner. Errors: `not_found`, `already_member`, `last_owner`, `forbidden`.
- `admin_cities()`: one row per game region: id, names (zh/en), time zone, counts of common and Landmark Wayposts, Corrupted Capsule spots, capsule spots, the region's six spawnable vessels, how many Corrupted Capsules are out in the current wave, live City Hunts, published private hunts, and map coverage (`covered`, `bytes`, `built_at`). Regions are implicit today (city name fields and per-region spawn sets); if that makes this unreliable, add a small `private.game_regions` table seeded from what is live and report it.
- `admin_city_map(p_region)`: Wayposts (id, names, lat, lng, kind, game_enabled, source_ref), Corrupted Capsule spots, the **current wave** for the whole region computed for the current ten-minute boundary without a player location (spot, vessel, lat, lng, expires_at, caught), City Hunt Keeper and Landmark points, published private hunt quests (id, hunt, lat, lng, picture).
- `admin_spawning()`: every vessel with its rarity, habitat, hour and date windows, the places it can spawn in, whether it is earned or a starter, plus per place: country, city, time zone, out now, caught today and this week. Also the shared `game_config` wave settings. Today places are a fixed list in `private.vessel_spawn_rules.regions` and cities are mapped to Taiwan inside `private.resolve_spawn`; move that into a small `private.game_regions` table (country, city, names zh/en, time zone, and later the coverage fields above) so phase 2 can add places without changing a function. Waves and spawns must stay exactly the same; prove it by comparing resolved waves before and after for every spot over a day.
- `admin_queue(p_status)`: one list across kinds. Phase 1 kinds `hunt_report` (from `private.private_hunt_reports`, grouped by hunt) and `public_capsule_report` (from `public.public_capsule_reports`, grouped by capsule), with counts, reasons, reporters, content preview and current visibility. `admin_queue_resolve(p_kind, p_id, p_decision 'restore'|'remove', p_note)`. Restoring clears the hide and keeps the previous reports in history. New reports reopen the item and count toward the existing two-report threshold. Removal is final. Each decision appends one audit row.
- `admin_activity(p_limit, p_before)`: newest first, with actor name and portrait.
- Map coverage: record the PMTiles areas (name, bounds, bytes, built date) in a table so `admin_cities` can show them; seed from `docs/design/public-sea-tiles.md`. The bounds, build date and measured per-city tile bytes are in [Public Sea city tiles](public-sea-tiles.md). The ten coverage areas are kept separately from the four active game cities.
- Grants: execute to `authenticated` only; each function refuses unless `admin_can`. Hosted rollback tests: non-member refused everywhere, each role's allowed and refused actions, last-owner guard, sealed `capsule_contents` still unreadable except the reported public capsule preview for moderator and up.

## A1 verification

Run `supabase/tests/admin-wave-before.sql` before the migration body, then
run `admin-wave-after.sql` and `admin-phase-one.sql` before rolling back.
Use a single transaction and omit the migration's outer transaction statements.
The signed-JWT suite is `node supabase/tests/admin-phase-one-api.mjs` against a
local Supabase stack with A1 loaded and a local Roy owner profile and password.

Private hunt quest coordinates assign visible published quests to city coverage
bounds. A city counts each hunt once when it has a quest in those bounds.
Catch totals use local midnight and the Monday start of the region's local week.
City-wide pins indicate whether anyone caught a spawn. Each player's catch and
spawn selection rules still use their own existing game RPCs.
The map can render bundled quest pictures. Organizer uploads retain the
existing private Storage rules.

## Backend contract for phase 2 (Codex)

Names may change if Codex has a better fit; report the final ones. Every write RPC requires `admin_can('edit')`, locks the row it changes, appends one `admin_actions` row with before and after in the same transaction, and returns the saved row. Grants as in phase 1.

**Wayposts** (`public.public_capsule_spots`, `game_enabled` rows and hidden ones):

- `admin_waypost_check(p_region, p_lat, p_lng, p_id default null)`: read only, for the card before saving. Returns `{ inside_coverage, nearest: { id, name_zh, name_en, meters } | null, live_hunts: [{ id, name_zh, name_en, wayposts_left, wayposts_needed }] }`. `p_id` excludes the Waypost being moved.
- `admin_waypost_add(p_region, p_lat, p_lng, p_name_zh, p_name_en, p_scene, p_checked boolean, p_note)`: `kind = 'common'`, `game_enabled = true`, `public_drop = true`, `city_zh/en` from the region, `source_ref = 'admin:' || id`. Errors: `forbidden`, `not_checked` (tick missing), `outside_coverage`, `too_close` (under 250 m with no note), `bad_scene`, `bad_name` (empty, or `name_zh` with no Chinese characters).
- `admin_waypost_update(p_id, p_lat, p_lng, p_name_zh, p_name_en, p_scene, p_note)`: null leaves a field as it is. Same checks for a move. Refuses `kind = 'landmark'` with `landmark`.
- `admin_waypost_set_visible(p_id, p_visible, p_note)`: sets `game_enabled`, and sets `hidden_at` when hiding or clears it when showing. Hiding refuses `hunt_needs_wayposts` when a live City Hunt's area would drop below what its spin quest needs, and refuses Landmarks.
- Add `hidden_at timestamptz` to `public_capsule_spots`. Rows that are only public capsule drop places also have `game_enabled = false` and `kind = 'common'`, so this column is how a hidden Waypost is told apart from them. `admin_city_map` also returns rows with `hidden_at` set, so edit mode can show them; it still leaves drop-only rows out.
- Coverage check: inside the region's `game_map_coverage` bounds.

- `admin_spot_set_visible(p_id, p_visible, p_note)` for `public.corrupted_spots`, with a `hidden_at` column the spawn code skips. `admin_city_map` returns hidden spots too.

**Spawning:**

- `admin_spawn_place_add(p_region, p_vessel, p_note)` and `admin_spawn_place_remove(p_region, p_vessel, p_note)` on `private.vessel_spawn_places`. Adding a vessel with no `vessel_spawn_rules` row creates one (common, no habitat, no windows). Refuse starter, earned and brand vessels with `not_spawnable`.
- `admin_spawn_rule_set(p_vessel, p_rarity, p_habitat, p_start_hour, p_end_hour, p_md_start, p_md_end, p_note)`: validate values (`bad_rule`); hour and date windows are both-or-neither.
- `admin_wave_config_set(p_spawn_chance, p_common_weight, p_uncommon_weight, p_rare_weight, p_nearby_target, p_note)`: ranges as in the screens; weights not all zero.
- `admin_wave_length_set(p_minutes, p_note)`: one of 5, 10, 15, 20, 30, 60. Stores the new length with its start time (the next moment that is a wave boundary under both lengths) instead of changing it at once; every wave calculation uses the length in force at that time, and visible minutes follow it. Returns the start time. Before building it, find every place (server and app) that assumes 10 minutes and report them.
- Guard on every spawning write: each region with Corrupted Capsule spots keeps at least one assigned vessel (its own or its parent's) with no hour or date window. Refuse with `place_needs_vessel`.
- `admin_spawn_preview(p_change jsonb)`: applies the proposed change inside a subtransaction that is always rolled back, resolves the next 24 hours of waves for the affected region with the real `private.resolve_spawn` (sampling every 6th wave is fine if a full day is too slow; aim for under 2 seconds), and returns per-vessel counts before and after. `p_change` names one of the write calls above and its arguments.

**Undo:** `admin_undo(p_action_id, p_note)` for `waypost.*`, `spawn.*` and `config.*` actions. It puts the target back to the action's `before`, runs the same checks as a normal edit, and logs `undo` with a link to the original action. Refuse `stale` if a newer action touched the same target, and `not_undoable` for other kinds.

**Activity names:** `waypost.add`, `waypost.move`, `waypost.edit`, `waypost.hide`, `waypost.show`, `spot.hide`, `spot.show`, `config.wave_length`, `spawn.place_add`, `spawn.place_remove`, `spawn.rule`, `config.wave`, `undo`.

**Tests:** hosted rollback for each role (only owner and admin can write), every error code, the 250 m warning and override, the coverage refusal, the hunt guard, the spawning guard, preview leaving no trace, and undo including `stale`. Real-JWT: an added Waypost appears in `game_nearby` for a player at that spot and disappears when hidden; a spawning change shows up in the next wave and not the current one.

## Build order

1. Codex: phase 1 backend (above). Claude, in parallel: phase 1 screens against a development mock behind `ADMIN_BACKEND = false`, then switched on when the RPCs land.
2. Phase 2 Waypost editing, Corrupted Capsule spawning and undo. Codex: the phase 2 backend contract. Claude, in parallel: the edit screens against the development sample behind an `ADMIN_EDIT_BACKEND` switch, stacked on Codex's branch once its RPCs land. The two land together; nothing about phase 2 shows before both are merged.
3. Phase 3 ODB import: Codex agrees the dataset contract with the ODB side first.
4. Phase 4 moderation, before the iPhone release.

## Roy to confirm

1. The four roles above.
2. `/admin` inside the same web app.
3. Moderators may read a reported public capsule, and a private letter only after its recipient reports it.
4. Private letters: blocked or allowed by the word check, never queued for staff.
5. Spawning is set per country and city now, with areas (one park, one campus) only later if needed.

OpenDashboard datasets come later (Roy, 2026-11-15).

### Phase 2: Roy to confirm

Defaults apply unless Roy changes them.

Roy answered on 2026-11-15:

1. Agreed: outside the city's map coverage, adding or moving a Waypost is refused. A new area goes through the City Hunt SOP.
2. Agreed: a vessel's rarity, habitat and time windows are the same everywhere it appears.
3. Replaced by the public capsule drop rule above: every safe point within 100 m can take a dropped capsule, hand-added Wayposts included.
4. The wave length is adjustable, switching at a moment that ends a wave under both lengths.
5. Landmarks are blue and stay with agents and the Landmark SOP. Corrupted Capsule spots get Hide and Show only.
