# City Orienteering: timed daily hunts and private hunts

Claude, 2026-11-14, from Roy's brief. This extends [city-hunt.md](city-hunt.md); where the two disagree, this doc wins. "City Hunt" (城市定向; private ones 私人定向) is the name in the app, and "quest" (任務) is one thing to do at a waypoint. Never 城市尋寶 or 關卡. Items marked **Roy to confirm** use the default written here until he says otherwise, so work can start.

## What Roy asked for
1. **System hunts** (ours: Xinyi, Senado, HKUST) stay, open **every day to everyone**, and become **timed** so they feel exciting.
2. **Private hunts:** organizations and people create their own hunt and share it, in the spirit of Goosechase (create → publish → review).
3. **Private waypoints** with **missions**: not only spinning, also puzzles and other tasks.
4. **Map colours:** everything of ours is **blue** (Wayposts and Landmarks, Landmarks in several shades of blue). **Brass now means private.** Private waypoints are a **location-pin shape**, not a gem.

## Part A: System hunts, daily and timed
- Every system hunt is open every day with no end date (`ends_at = infinity`), including Xinyi. Unfinished progress resets at local midnight, as Senado and HKUST do today.
- **The clock starts at check-in** with the Letter Keeper and **stops when you return** to him.
- Each hunt has a **time limit** (`time_limit_min`; start with 60 for Xinyi and HKUST, 45 for Senado, to tune). Finish inside it and the run counts. Run out and the run ends with 「時間到了」; you can check in again and start a new run the same day.
- The app keeps **today's time** and your **personal best** per hunt. A new best shows 「新紀錄」.
- **Rewards:** the stamp, Gold and XP are still once only per hunt. A later finished run gives a small XP amount once per day (start with 50, to tune).
- **No public ranking on system hunts** (the existing rule holds: nobody sees who was fastest). **Roy to confirm**; a daily top-10 could be added later without schema changes.
- Screens: the Quest sheet shows the limit before joining, a running countdown after check-in, and best / today's time when finished. A small countdown chip sits on the map during a run. The Keeper gets two new lines (time's up, new record), zh and en.

## Part B: Private hunts
A private hunt is made by an **organizer**, joined by **code, link or QR**, and seen only by people who joined. It has its own brass waypoints, each with one **quest (任務)**. It never touches the system game economy.

### Organizer: Create → Publish → Review (Goosechase mapped to v1)
| Goosechase | v1 (this patch) | Later |
|---|---|---|
| Details: image, name, description, location, password, search visibility | Cover (upload or one of our illustrated covers), name, description. **No radius:** the hunt's area is derived from its quests (centre of the quests, reaching the furthest plus 25%, at least 200 m). Always hidden: join by code only | Public listing in search |
| Missions: name, type, points, description, image, link | Each **waypoint** carries one quest: the organizer **drops its pin on a map** and the place name fills in the quest name; type; **points 1–999 typed freely**; description; optional image | Link, mission library |
| Availability: release / expiry rules, draft | Route mode for the whole hunt: **any order** or **in order**. The hunt itself is draft until published | Per-mission release and expiry, point-total unlocks |
| Submission settings (feed, photo/video, sources) | Not needed for v1 mission types | With photo missions |
| Broadcasts | — | Phase 2 |
| Branding, custom terms | Cover image only | Phase 2 |
| Participants: link, QR, code; teams or individuals | Link, QR and a 6-character code. **Individuals only** | Teams |
| Start & end | **A start time and an end time, both required** (a coordinated event). Players may join before the start; nobody can complete a quest before it. Optional per-player time limit, timed from the later of joining and the start, and cut short by the end time | — |
| Review: feed, leaderboard, submissions, stats | **Leaderboard** (points, then time; organizer can hide it from players), participants with progress, stats (joined, finished, completion per quest) | Activity feed, adjust score, submissions review |

### Quest types (v1)
| Type | Player does | Server checks |
|---|---|---|
| **到達 Arrive** | Walks to the pin and taps Check in. The organizer chooses **GPS** or **GPS + QR**: with QR, the player also scans a code the organizer printed and left at the spot | Within 50 m, accuracy rule as elsewhere; with QR, the scanned token must match that waypoint's secret `qr_token` |
| **轉盤 Spin** | Spins the existing Waypost wheel at the pin | Within range; gives points only, **no balls or XP** |
| **謎題 Puzzle** | Reads a question at the pin and answers: free text or multiple choice | Within range; answer compared on the server (case and spacing ignored); answers never sent to clients; 3 tries then a 60 s wait |
| 拍照 Photo | Phase 2 | Needs storage, organizer review and Roy's moderation decision |

### Player
- Joins from a link, QR or by typing the code in the Quest sheet (「輸入代碼」). Sees the cover, description, rules, time and Join.
- After joining, the hunt's **brass pins** appear on Journey. Tapping one in range opens its quest. Points add up; finishing every quest (or the organizer's end time) ends it.
- Quest sheet lists the quests with points and ticks, the clock if there is one, and the leaderboard if the organizer shows it.
- One system hunt and one private hunt can be active at the same time; the Quest sheet has two tabs when both are.

### Rules and safety
- **Other players never appear on the map.** The organizer sees names, points and finish times, never live locations.
- Private hunts give **no XP, Gold, balls or vessels** (no farming). Finishing gives a **brass private-hunt stamp** in the Passport, in its own section, carrying the hunt's name. **Roy to confirm.**
- **Who can create:** accounts with `profiles.can_create_hunts = true`, set by us for the pilot (Roy and chosen organizers). Opening it to everyone is one policy change later. **Roy to confirm.**
- Limits (to tune): 30 waypoints per hunt, 500 participants, 3 unfinished hunts per organizer, name 60 and description 500 characters, puzzle answer 80.
- A **Report** button on every private hunt; 2 reports hide it until reviewed, like sea bottles. All text is the organizer's own; AI writes nothing.
- Landmark fights and Corrupted Capsules stay in system hunts only.

## Map look
| Thing | Now | New |
|---|---|---|
| System Waypost | Blue gem (purple on cooldown) | Unchanged |
| System Landmark monument | Brass fading to cream | **Blues:** navy `#16263F` base → ink blue `#2F5D8A` → light blue `#5A8FD0` → glass `#DCE8F2` top. Landmark seal in blue. Code only (`mapHtml.ts`) |
| Private waypoint | — | **3D brass location pin** (art, see below) with a small glyph for its quest (flag, wheel, question mark). Done: **purple, like a spun Waypost**, with a tick. Locked (in-order route): dashed outline. Until the art lands, a flat code-drawn pin stands in |
| Letter Keeper marker | Brass seal | Stays brass (he is a person, not a waypoint). **Roy to confirm** |

Brass pins scale with zoom like other pins and only joined players see them.

## Art (one art session, `gpt-image-2`, follow `design/art/STYLE.md`; three test pieces for Roy first)
1. **3D brass location pin** master (Roy: the quest pins should look 3D, like the Wayposts' gems, not flat), 1024×1024 transparent, tip anchored at (512, 960), readable at 40–96 px. The **done variant is purple** (the spun-Waypost purple) and the locked variant is dimmed; both are made **by script** from the master. Quest glyphs are drawn in code on top, so leave a clear round face on the pin head.
2. **Private-hunt Passport stamp:** round, one colour, **brass**, double ring, a location-pin motif, no lettering.
3. **Six default hunt covers** (16:9, 1280×720): park, campus, old town, waterfront, city centre, museum quarter.
4. **One scene:** an empty "my hunts" state (a folded map with brass pins).
No new art for Landmarks (code) or timers and mission icons (code-drawn, like `ArtIcon`).

## Backend contract (Codex)
Keep hunt bookkeeping from ever failing the original action; every location and time check is on the server; content of puzzles stays unreadable by clients.

**A. Timed daily** (`T` session)
- `hunts.time_limit_min integer null`; `hunts.repeat_xp integer not null default 50`.
- `hunt_runs(hunt_id, user_id, started_at, finished_at, duration_s, day)` or equivalent; best time derived or stored.
- `hunt_check_in` starts a run; `hunt_finish` refuses with hint `time_up` after the limit; expiry needs no scheduled job (computed on read, like the midnight reset).
- Hunt objects from `hunt_list` / `hunt_join` gain `time_limit_min, run_started_at, run_ends_at, best_s, today_s, finished_today`.
- All three system hunts set to daily, `ends_at = infinity`.
- Data: rename existing hunt names from 城市尋寶 to 城市定向 (e.g. 信義城市尋寶 → 信義城市定向).

**B. Private hunts** (`P1` organizer, `P2` player)
- `hunts` gains `kind ('system'|'private') default 'system'`, `owner uuid`, `status ('draft'|'published'|'closed')`, `join_code` (unique, 6 chars, unambiguous alphabet), `description`, `cover`, `route_mode ('any'|'ordered')`, `leaderboard_visible`, and reuses `time_limit_min` for the optional per-player limit, with system-only columns (keeper, landmark, rewards) nullable for private. Private hunts require finite `starts_at < ends_at`. **No organizer-set area:** the server derives the private hunt's area from its waypoints when it returns a hunt.
- `hunt_waypoints(id, hunt_id, ordinal, lat, lng, name, mission_type ('arrive'|'spin'|'puzzle'), points (1–999), description, image, puzzle_kind ('text'|'choice'), choices jsonb, arrive_check ('gps'|'gps_qr') default 'gps')`; answers and `qr_token` in a table clients can't read. `qr_token` is random and issued on save when `arrive_check = 'gps_qr'`; only the owner's `hunt_edit_state` returns it.
- `hunt_members(hunt_id, user_id, joined_at, started_at, finished_at, points)`; `hunt_completions(waypoint_id, user_id, completed_at, tries)`.
- Organizer RPCs: `hunt_create`, `hunt_update`, `hunt_waypoint_save`, `hunt_waypoint_delete`, `hunt_publish`, `hunt_close`, `hunt_edit_state(p_hunt)` → `{ draft, waypoints, status, code }`, `my_hunts()`, `hunt_review(p_hunt)` → `{ members: [{ name, avatar, points, finished_at, duration_s }], stats: { joined, finished, per_waypoint: [{ id, done }] } }`. Owner only; `can_create_hunts` required to create.
- Player RPCs: `hunt_preview(p_code)`, `hunt_join_code(p_code)`, `hunt_private_state(p_hunt)` → hunt + waypoints (no answers) + my completions, `hunt_mission_complete(p_waypoint, p_lat, p_lng, p_accuracy, p_answer, p_qr)` → `{ ok, points, state, tries_left, wait_s }` (refuses `not_started` before `starts_at`, `time_up` after the run ends, and a wrong or missing `p_qr` on a GPS + QR quest)., `hunt_leaderboard(p_hunt)` (members only, and only if visible or caller is owner), `hunt_report(p_hunt)`.
- Player hunt objects carry `run_started_at = greatest(joined_at, starts_at)` and `run_ends_at = least(run_started_at + time_limit_min, ends_at)` (just `ends_at` with no limit). Joining is allowed any time before `ends_at`. Waypoints returned to players include `arrive_check` but never `qr_token`.
- `my_passport()` returns private-hunt stamps with `how_earned = 'private_hunt'` and the hunt name.
- Covers and mission images: a private Storage bucket readable only by the owner and members.
- Client flags in `mobile/src/services/hunt.ts` style: `HUNT_TIMED_BACKEND`, `HUNT_PRIVATE_BACKEND`, false until applied.

## Work split
**Claude (UI, PRs from the fork)**
| PR | What | Needs |
|---|---|---|
| U1 | Blue Landmark monuments and seal; timer in Quest sheet and map chip; Keeper lines | Nothing (dev fallback until `T`) |
| U2 | Private hunt for players: enter code / link, preview, brass pins on Journey, mission screens (arrive, spin, puzzle), Quest tab, leaderboard, Passport section | Pin art (placeholder until art lands) |
| U3 | Organizer: My hunts, create and edit (details with start and end, quests dropped on a map, GPS / GPS + QR, free points), publish (code, link, QR), review | — |
| U4 | Player QR scanner for GPS + QR quests | A camera dependency (`expo-camera`), Roy to approve |

**Codex: 5 sessions for this patch** (each its own branch and worktree)
| # | Session | Branch | Can start | Size |
|---|---|---|---|---|
| 1 | `T` Timed daily system hunts | `codex/hunt-timed` | Now | Small |
| 2 | `P1` Private hunts: schema + organizer RPCs + storage | `codex/hunt-private-organizer` | Now | Large |
| 3 | `ART` Pin, stamp, covers, scene | `codex/art-private-hunt` | Now | Medium (Roy approves art) |
| 4 | `P2` Private hunts: player RPCs, missions, leaderboard, stamps, report | `codex/hunt-private-player` | After `P1` merges | Large |
| 5 | `REL` Merge U1–U3, flip the flags, real-login tests, release, update `docs/sop/city-hunt.md` and add `docs/sop/private-hunt.md` | `codex/hunt-release` | After 1–4 and U1–U3 | Medium |

Sessions 1, 2 and 3 run in parallel (they touch different files; `T` and `P1` both alter `hunts`, so `P1` rebases on `T` if `T` merges first). **Phase 2, later (about 2 more sessions):** photo missions with organizer review, teams, broadcasts, score adjustment, public listing. It waits for Roy's moderation decision, the same one as media in public capsules.

## Session prompts
Every session: repo https://github.com/royai202600-cyber/time-capsule, read `AGENTS.md` and this file first, own branch and worktree, end with the standard Codex report.

**1 · `T`**
> Build "Part A" and backend contract section A of `docs/design/city-orienteering.md` on `codex/hunt-timed`: time limit and runs, personal best and today's time, once-per-day repeat XP, all three system hunts daily with no end. No scheduled jobs. Hunt bookkeeping must never fail spin, catch or landmark actions. Extend the hunt object and `database.types.ts`, keep the client flag `HUNT_TIMED_BACKEND` false until the migration is applied, then apply, verify with a disposable real login (run inside the limit, run past the limit, second run same day, midnight reset) and set it true. Don't change screens beyond wiring; Claude's PR U1 owns them.

**2 · `P1`**
> Build the schema, organizer RPCs and storage from backend contract section B of `docs/design/city-orienteering.md` on `codex/hunt-private-organizer`: the `hunts` additions, `hunt_waypoints` with unreadable answers, `hunt_members`, `hunt_completions`, `profiles.can_create_hunts`, `hunt_create/update/waypoint_save/waypoint_delete/publish/close`, `my_hunts`, `hunt_review`, the private bucket and its policies, and the limits in "Rules and safety". System hunts must behave exactly as before (run the existing hunt tests and a real-login Xinyi check). Set `can_create_hunts` for Roy's accounts only. Add `HUNT_PRIVATE_BACKEND = false` and typed client calls; no screens.

**3 · `ART`**
> Art session for `docs/design/city-orienteering.md` "Art", on `codex/art-private-hunt`, following `design/art/STYLE.md` and its approval steps. First make three test pieces for Roy: the brass location pin at 40/64/96 px on the map palette (light and water backgrounds) beside a blue Waypost gem, the brass private-hunt stamp at 24/40/64/120 px beside the Xinyi stamp, and one cover (park). After Roy approves, finish the done and locked pin variants by script, the remaining five covers and the empty "my hunts" scene, register them in `mobile/src/art/manifest.ts`, and open an art-only PR.

**4 · `P2`** (after `P1` is merged)
> Build the player side of backend contract section B on `codex/hunt-private-player`: `hunt_preview`, `hunt_join_code`, `hunt_private_state`, `hunt_mission_complete` for arrive, spin and puzzle (server-side distance, accuracy, ordered-route and answer checks; 3 tries then 60 s), points and finish, `hunt_leaderboard`, `hunt_report` with the 2-report hide, and private stamps in `my_passport`. Private hunts must grant no XP, Gold, balls or vessels. Verify with two disposable real logins plus an organizer: wrong and right answers, out-of-range attempts, ordered route, time limit, leaderboard hidden and shown, a non-member reading nothing.

**5 · `REL`** (after sessions 1–4 and Claude's U1–U3)
> Release City Orienteering: review and merge Claude's PRs U1–U3, set `HUNT_PRIVATE_BACKEND = true`, run CI, the web and iOS exports, and a 375 px zh/en browser pass of: a timed Xinyi run, creating and publishing a private hunt with one mission of each type, joining it by code from a second account, finishing it, the leaderboard, the organizer review and the brass Passport stamp. Deploy, then update `docs/sop/city-hunt.md` for timed daily hunts and write `docs/sop/private-hunt.md`. Record the release in `AGENTS.md` and `docs/TASKS.md`.

## Roy to confirm (defaults above are used meanwhile)
1. System hunts: a countdown limit plus personal best, with no public ranking.
2. Private hunts v1 has Arrive, Spin and Puzzle; Photo waits for the moderation decision.
3. Only allow-listed accounts can create hunts during the pilot.
4. Private hunts give a brass stamp and no XP, Gold or vessels.
5. The Letter Keeper's marker stays brass.


## Part C backend contract (Roy approved 2026-11-14; UI design in PR #125)

- `guide_mode: 'fixed' | 'near'` defaults to `near`. `guide_lat/guide_lng` are required for fixed and null for near. `private_hunt_update` accepts these in `p_draft`; edit state and player objects expose them. Old callers omitting guide fields preserve them. Guide settings lock at first join, like route/timing.
- `private_hunt_start(p_hunt, p_lat, p_lng, p_accuracy)` returns the player hunt object. Fixed: at most 50 m; near: inside derived area; valid accuracy is `(0, 200]` m. Refuses before the scheduled start, after closure/end, and for nonmembers. Retry preserves the original timer; no restart. New joins have null `started_at`, `run_started_at` and `run_ends_at` until this call. Existing runs retain their start.
- Finishing all quests sets `finished_at`. `private_hunt_collect_reward(p_hunt, p_lat = null, p_lng = null, p_accuracy = null)` returns the hunt with `reward_collected_at`. Before `ends_at`, the same guide check applies, even after an early organizer close. At/after `ends_at`, finished members can claim from Passport without GPS. Unfinished members cannot claim. Retrying never duplicates a stamp. Existing earned stamps are backfilled; `my_passport` shows collected stamps only. `private_hunt_joined` includes ended hunts so Passport can find pending claims.
- A `restore` quest has `catch_count` from 1 to 20 and null location fields; other quest types keep required locations and null `catch_count`. Save uses `private_hunt_quest_save`. Player quests expose `caught_count`, separate from the goal `catch_count`. Manual completion refuses `catch_required`; actual successful Corrupted Capsule catches update it. Both the player and the caught capsule must be inside the hunt area, during a started, unexpired run. Ordered routes count only unlocked quests. Each completed quest adds its points once, with no extra game rewards. Private bookkeeping is isolated from catches and City Hunt progress.
- Area remains derived from located quests. For catch-only routes, a fixed guide anchors a 200 m area. Publishing a near-guide hunt without a located quest refuses `area_required` instead of silently using coordinates `(0,0)`.
- Existing old-name wrappers remain callable and translate the original payload keys. New start/reward calls are required for new runs; clients must wire them before this held migration is released. City Hunt Keeper/timer behavior is unchanged.

Validation: `supabase/tests/private-hunt-guide-api.mjs` (local real JWT), `supabase/tests/private-hunt-guide.sql` (transaction/rollback only), and the updated existing private-hunt player API suite. The SQL suite deliberately injects a bookkeeping failure and must always be wrapped in a rollback. Migration remains unapplied pending Claude review.
