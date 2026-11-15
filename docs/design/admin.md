# Admin (管理後台)

Status: Roy approved the plan on 2026-11-15. PR #133 supplies the screens. The stacked A1 branch enables the RPCs with migration `20261115090250_admin_phase_one`, held for Claude's review.

Screens: `mobile/app/admin/` routes, `mobile/src/features/admin/` (shell, Overview, Corrupted Capsules, City map, Review, Members, Activity), `mobile/src/services/admin.ts` (types and RPC calls the screens expect). Run `cd mobile && npm run web` and open http://localhost:8088/admin. For local design work, set `ADMIN_BACKEND` to `false`. The sample opens without signing in and has a **View as** switch for each role.

## Why

Roy can't see which cities are open, which Corrupted Capsules are out, or what is on the map, and only Codex can change a Waypost. More people will help later, outside data will come in through OpenDashboard, and capsules need moderation before the App Store. Admin gives the team one place to see and run the game.

## Decisions in this plan

- **Where it lives:** a hidden `/admin` route inside the existing Expo web app (`mobile/app/admin/`), web only. It shares sign-in, the Supabase client, translations and the theme, and needs no second Vercel project. Native builds show nothing at `/admin`.
- **Look:** the Time Capsule look, not a generic dashboard. Cool paper background, Noto Serif TC headings and numbers, Noto Sans TC body, ink blue for controls, brass only for precious things (Landmarks, vessels), wax red for remove/destructive actions, the same cards, pills and portraits as the app. Both languages, switchable.
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
3. **City map (城市地圖).** MapLibre with our map style. Layers you can switch: Wayposts (blue gem, Landmark brass), Corrupted Capsule spots, the current wave (vessel picture with minutes left; caught ones faded), City Hunt Keeper and Landmark, private hunt quests (brass teardrop). Tap a pin for a detail card. View only in phase 1.
4. **Corrupted Capsules (破損膠囊).** Which vessels can appear where. Two views of the same rules:
   - **By place:** each country, then its cities (Taiwan → Taipei, Hong Kong, Singapore, Macau today). Each shows its spawnable vessels as art with rarity (common / uncommon / rare), any habitat (park, water, square), hour window and date window, plus how many are out right now and caught today and this week.
   - **By vessel:** every vessel in the catalogue, in Album order, with where it can appear. Vessels that can't appear anywhere sit in their own group, and earned (Landmark) and starter vessels are marked as never spawning.
   - The shared wave settings at the top: wave length (10 minutes), chance a spot shows something, rarity weights, how many appear near a player (6).
   - View only in phase 1; changing them is phase 2.
5. **Review queue (待審).** One list for every kind of item. Phase 1 kinds: reported private hunts and reported public capsules, with report count, reasons, reporters (portraits) and the content. Actions: Restore or Remove, with an optional note. Done items move to a Done tab.
6. **Members (成員).** Owner only. List with portrait, name, email, role, added by and when. Add by email, change role, remove.
7. **Activity (紀錄).** The action log: who, what, when, with before and after. Filter by person and kind. Viewer and up.

### Phase 2: Waypost editing

On the city map: tap the map to add a Waypost (both names, kind), drag to move, edit names, hide or show. Remove = hide (`game_enabled = false`), so spin history stays and it can be undone from Activity. The server warns when a Waypost is closer than 250 m to another one or outside the city's map coverage; an admin can override with a note. The OSM safety filter (schools, temples, hospitals, private land, roads) still runs only in the seed script, so new Wayposts by hand carry the note "checked by hand".

### Phase 2: Corrupted Capsule spawning

On the Corrupted Capsules page an admin can add a vessel to a place or take it away, set its rarity, habitat and hour/date windows, and change the shared wave settings. Each change shows a preview first (what this place's wave would look like) and lands in Activity, so it can be undone. Changes apply from the next wave; capsules already out keep going until their wave ends. Earned and starter vessels can't be added.

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
- `admin_cities()`: one row per game region: id, names (zh/en), time zone, counts of common and Landmark Wayposts, Corrupted Capsule spots, capsule spots, the region's three spawnable vessels, how many Corrupted Capsules are out in the current wave, live City Hunts, published private hunts, and map coverage (`covered`, `bytes`, `built_at`). Regions are implicit today (city name fields and per-region spawn sets); if that makes this unreliable, add a small `private.game_regions` table seeded from what is live and report it.
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

## Build order

1. Codex: phase 1 backend (above). Claude, in parallel: phase 1 screens against a development mock behind `ADMIN_BACKEND = false`, then switched on when the RPCs land.
2. Phase 2 Waypost editing and Corrupted Capsule spawning.
3. Phase 3 ODB import: Codex agrees the dataset contract with the ODB side first.
4. Phase 4 moderation, before the iPhone release.

## Roy to confirm

1. The four roles above.
2. `/admin` inside the same web app.
3. Moderators may read a reported public capsule, and a private letter only after its recipient reports it.
4. Private letters: blocked or allowed by the word check, never queued for staff.
5. Spawning is set per country and city now, with areas (one park, one campus) only later if needed.

OpenDashboard datasets come later (Roy, 2026-11-15).
