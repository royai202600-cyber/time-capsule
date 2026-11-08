# Public Sea (公開的海)

Roy liked the "public sea" idea from Codex's standalone concept demo (a map of message bottles near you). Claude took the concept, not the demo's code or format, and folded it into the app (2026-11-08).

## Product rules (Roy's decisions)
- **One capsule format.** A sea bottle is an ordinary capsule addressed to **the sea**. It is written in the normal Create flow (step 1 has a new recipient, 大海 · 給陌生人), uses an owned vessel, and is opened on the normal capsule pages with hold-to-open.
- **Typed letters only.** Handwriting, photo and voice are hidden for sea bottles, because only typed text can be safety-checked automatically.
- **Profiles are visible** (Roy: "if we can see the person profile, it will be more fun"). The map pin and card show the sender's portrait, name and city. The finder appears to the sender in Sent.
- **Place is a public shore, never the sender's spot.** Sending snaps the bottle to the nearest public **shore** (park, waterfront or square) within 3 km. If there is none, the send is refused with `no_shore`.
- **Time still matters.** The sender picks a drift time of 1, 7, 30 or 365 days, which sets `open_at`. The bottle is invisible until then (it is "drifting"), then it is ashore.
- **One finder.** Anyone within **100 m** (server-checked, the same accuracy rule as `open_capsule`) can pick it up. Picking up makes them its recipient, and it then opens like any capsule. A user can pick up 3 bottles a day. Nobody can pick up their own bottle.
- **Keep or return.** Keep needs no call: it stays in the finder's Inbox. Return to the sea clears the recipient, moves the bottle to a different shore at least 1 km away, sets `open_at` to now plus 1 day, adds 1 to `returns`, and never shows it to that finder again.
- **Report.** A report hides the bottle from the reporter at once. After 2 reports it is hidden from everyone until reviewed.
- **One live map.** Journey is now a tilted MapLibre map that follows you, using Protomaps vector tiles in our palette. It shows sea bottles plus your own capsules waiting at places. The illustrated Asia map is still there as the zoomed-out view, next to the Passport. On phones the map runs in `react-native-webview`, so it works in Expo Go. Map tiles are city PMTiles extracts in **Cloudflare R2**.

## Code (Claude, branch `claude/public-sea`)
- `mobile/src/services/sea.ts`: the backend contract below, the `SEA_BACKEND` flag, an in-memory dev sea, and `MAP_PMTILES_URL` (from `EXPO_PUBLIC_MAP_PMTILES_URL`).
- `mobile/src/features/journey/JourneyScreen.tsx` + `live/`: the live map (`mapHtml.ts` holds the style; `LiveMap.native.tsx` uses WebView; `LiveMap.web.tsx` uses an iframe).
- `mobile/src/features/create/CreateScreen.tsx`: the sea recipient, typed-only letters and drift choice. It calls `sea.throwBottle`.
- `mobile/src/features/sea/SeaLetterActions.tsx`: Keep / Return / Report under an opened sea letter, replacing Reply.
- Home and Capsule show "大海" as the recipient while a sent bottle is unfound.

## Backend contract (Codex)
Capsules table: `sea boolean not null default false`, `shore uuid null references sea_shores`, `sea_returns int not null default 0`. `recipient` becomes nullable **only** for `sea = true`. While unfound, `recipient is null` and the capsule appears in the sender's Sent list.

`sea_shores(id, name_zh, name_en, city_zh, city_en, lat, lng)`: hand-picked public spots in the cities of our 10 places, around 6 per city. Take coordinates from OpenStreetMap and record the source in the migration comment.

RPCs. All are `security definer`, execute is granted to `authenticated` only, and they raise errors whose message contains the code shown.

| RPC | Args | Returns | Errors |
|---|---|---|---|
| `sea_nearby` | `p_lat, p_lng, p_accuracy` | Rows `{id, hint, vessel, lat, lng, shore_zh, shore_en, sealed_at, washed_up_at, returns, sender:{id,name,avatar,city}}` ashore within 5 km. Excludes your own, ones you returned or reported, and hidden ones. **Never** the letter. | |
| `sea_pick_up` | `p_id, p_lat, p_lng, p_accuracy` | Sets `recipient = auth.uid()`, row-locked. | `too_far`, `taken`, `daily_limit`, `own_bottle` |
| `sea_return` | `p_id` | Only the opened recipient. Drifts as above; resets `opened_at`/`seen_at`. | |
| `sea_throw` | `p_message, p_hint, p_vessel, p_drift_days (1/7/30/365), p_lat, p_lng, p_accuracy` | `{id, shore_zh, shore_en, washes_up_at}`. Same vessel-ownership rules as `send_capsule`. Typed only, at most 280 characters. | `no_shore`, `rejected` (safety check) |
| `sea_report` | `p_id, p_reason (unkind/personal/spam/other)` | Records the report; hides as above. | |
| `sea_pickups_left` | | int | |

The safety check for v1 is server-side: block phone numbers, emails, URLs and a word list (zh and en). Leave room for a moderation API later; it needs Roy's decision.

The profiles RLS must let a finder read the sender's profile and let the sender read the finder's profile, for sea capsules only.

When the backend is in, set `SEA_BACKEND = true`, regenerate the types and remove the dev sea.

## Later (not in v1)
- Golden history bottles at landmarks, with sourced stories.
- The puzzle unlock idea.
- Feed ranking (distance, freshness, keep rate, variety).
- Notifying the sender when their bottle is found.
- A review queue for reported bottles.
