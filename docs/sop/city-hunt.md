# SOP: Creating a City Hunt

How Codex adds a new City Hunt on its own. A hunt is **data only**: one migration, one Passport stamp, no screen changes. The rules of the game are in [`docs/design/city-hunt.md`](../design/city-hunt.md); this SOP never changes them.

## One-time setup (before the second hunt only)
Completed in `20261110085702_hunt_keeper_names.sql` on 2026-11-10; use the fields below for every new hunt.

The app's Keeper lines read the meeting spot and the Landmark name from the hunt, with a fallback for Xinyi. The setup added:
- Columns `keeper_spot_zh` and `keeper_spot_en` (text, not null) on `public.hunts`, filled for Xinyi with 市府廣場 / Civic Square.
- `private.hunt_object` also returns `keeper_spot_zh`, `keeper_spot_en`, and `landmark_name_zh`, `landmark_name_en` (the `name_zh` / `name_en` of the hunt's Landmark row in `sea_shores`).
- The database types were regenerated. The app reads these fields; no other hunt behaviour changed.

## What Roy gives you
- The area (for example "Marina Bay, Singapore").
- The dates and times, in local time.
- Anything different from the defaults below (usually nothing).

## Rules for choosing everything
Hunts can only be in areas we already cover: Taipei, Hong Kong, Singapore and Macau (map tiles plus Corrupted Capsules). Anywhere else, stop and ask Roy.

| Item | Rule |
|---|---|
| **Landmark** | An existing, game-enabled Landmark Waypost (`sea_shores.kind = 'landmark'`) in the area. If there isn't one, stop and ask Roy. If it has no monument yet, the hunt still works (only its seal floats); a monument is a separate task, following [`landmark-monument.md`](landmark-monument.md). |
| **Hunt area** | A circle, radius 800–1,500 m, centred on a public plaza near the Landmark. It must contain the Landmark, the Keeper's spot, at least **spin goal + 2** game-enabled common Wayposts, and Corrupted Capsule spots spread around it. Count them with a query and put the numbers in the report. |
| **Keeper's spot** | A public square or park on footpaths, inside the area, 300–700 m from the Landmark. Never on a road, or at a school, place of worship or private property (the same exclusions as capsules). Short names for his line: 「我在{spot}等你」 / "I'm waiting at {spot}". |
| **Steps** | Always all five, in this order: check-in 1, spin **3**, restore **5**, landmark 1, return 1. |
| **Route** | A walk of about 2–2.5 km, 40–60 minutes, through the Wayposts. List a suggested route in the report, as in the design doc's Xinyi table. |
| **Window** | Real hunts: 2–3 hours, for example Saturday 14:00–17:00 local time. Test hunts may be longer. Store times with the city's time zone. Publish it at least a few days ahead so people see it as upcoming. **Only one open hunt per city at a time.** |
| **Reward** | +300 XP and 5 Gold Wax Balls. Never random, never ranked. |
| **Id** | `<area>-<yyyy>-<mm>`, lowercase ASCII, for example `marina-bay-2026-12`. Add `-<dd>` if the same area has two in a month. |
| **Names** | `name_zh` 「<地區>城市尋寶」, `name_en` "<Area> City Hunt"; `city_zh` / `city_en` as the Waypost rows use them. |

## Steps
1. **Pick everything** with the rules above, using queries against the live database (read only). Check the Keeper's spot and the area on the real map.
2. **Write one data-only migration** `supabase/migrations/<timestamp>_hunt_<id>.sql`, copying the Xinyi insert in `20261110064954_city_hunt_backend.sql`:
   - Insert the hunt, finding the Landmark by its `source_ref` (never a hard-coded uuid).
   - Insert the five steps.
   - End with a check that raises an error if the hunt row is missing (the Landmark wasn't found).
   - Never edit an old migration, and never touch any player's progress or stamps.
3. **Make the Passport stamp** (art, `gpt-image-2`), following `design/art/STYLE.md`'s stamp rules: round, **one colour, ink blue, double ring** like the Xinyi stamp, the area's landmark as the motif, no lettering. Name it `design/art/stamps/stamp-hunt-<id>.png`, run `design/art/scripts/normalize-stamps.py` on the new file only, export `public/art/stamps/stamp-hunt-<id>.webp`, and add `'hunt-<id>'` to `stamps` in `mobile/src/art/manifest.ts`. Show Roy the stamp for a yes. If the art isn't ready, the hunt can still go live: the Passport shows a scroll icon until the stamp ships.
4. **Test before applying:** dry-run the database push and confirm it lists only this migration. Apply it inside a transaction and roll back once to check it runs.
5. **Apply and verify with a real login** (a disposable account, moved by simulated location):
   - The hunt appears in `hunt_list` as upcoming before its start, and as open during it.
   - Join, check in at the Keeper, spin, restore, win the Landmark, finish: the reward arrives once and the stamp shows in `my_passport`.
   - Outside the window, joining returns `closed`.
   - Then remove the disposable account and all its rows.
6. **Check the app at 375 px**, in Chinese and English: the Quest sheet shows the hunt, its countdown and reward; the Keeper stands at his spot; his lines name the right spot, Landmark and counts.
7. **Report** in the usual format, add a Decisions-log line in `AGENTS.md`, and update `docs/TASKS.md`.

## Stop and ask Roy when
- There's no Landmark in the area, or the area is outside our four cities.
- Someone wants a new kind of step, a special vessel, a different reward, or different Keeper lines.
- The hunt would overlap another open hunt in the same city.
- Fewer Wayposts or capsule spots than the rules need.

## After a hunt ends
Nothing to do. Leave its rows in place: players keep their stamps and finished hunts.
