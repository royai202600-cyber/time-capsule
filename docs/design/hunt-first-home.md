# Hunt-first home, Waypost spin → rack, Waypost levels

Roy approved this on 2026-11-21 after playing the demo (a scratch HTML demo that is not kept in the repo). The production version follows the demo's look, but it fits into the app's existing screens instead of copying the demo one to one.

## 1. The app opens on Today's Hunt

- Journey is the home screen (`/`). It opens in **Today's Hunt** mode: the city cards, the Play button and the map flying between cities, played from anywhere.
- A switch at the top (`今日尋寶 | 探索` / `Today's Hunt | Explore`) moves to **Explore**, the live map around you. Your profile picture sits beside it and leads to Me. Your wax-ball count is on the right.
- **Without location, you stay on Today's Hunt.** The app never switches to Explore on its own. If you tap Explore without a location, it asks for one and offers a way back to Today's Hunt.
- A route link (`/?route=…`) or a hunt link (`/hunt/CODE`) opens on Explore, where it is shown. The old `/journey` links redirect to `/` with their parameters.
- **One dock for both modes:** Passport · Quests on the left, **Capsules** · Cabinet on the right. The four icons are drawn in code, in the same family as the folded-map and wax-seal icons (`components/DockIcons.tsx`).
- **Capsules** opens the time-capsule card stack (Inbox / Sent, ＋ to send) as a modal at `/capsules`. A wax-red badge counts the capsules you can open right now (time passed, and place reached if it has one).

## 2. Common Waypost: spin first, then its rack

- If you tap a common Waypost within reach, its own screen opens on the **spin**. There is no way to skip it, because spins are what level a Waypost up. The rewards rise from the disc as before.
- After the spin, two plain wooden **doors** with brass knobs close and swing open onto the **capsule rack**.
- The rack is a wooden wine rack: one cabinet with a crown, rows of four deep round cubbies, shelf boards and a base. Each cubby holds the public capsule bottle lying on its side, with:
  - the sender's profile picture;
  - a plum padlock for a question lock;
  - a small tag: Ready, 3h, 7d or Mine.
- One free cubby always shows, so there is visibly room for another capsule.
- The filters sit above the rack (All, Ready, Waiting, Question, Friends, Mine), followed by the next-spin countdown.
- **Leave a capsule here** is the wax-red button fixed at the bottom of the same screen.
- Tapping a bottle lifts it out and opens the usual public-capsule card: hint, sender, question lock and hold to open. A capsule you just left slides into its cubby when you come back.
- Already spun and cooling down? Tapping the Waypost goes straight to the rack.
- If the spin fails (no signal, too far), the disc comes back to try again. It never falls through to the rack.
- If you're out of reach, a small card shows the distance and how many capsules are on the rack.

## 3. Waypost levels

- **Nothing changes on the map.** The gem looks the same at every level. A new look (skin) after a certain level may come later.
- A common Waypost grows from **spins only**: every spin by anyone adds **1 XP**, with no daily cap. It's a community thing, so more spins should always help; the existing spin cooldown already paces each player. Leaving or opening capsules adds no XP, so nobody can farm it by dropping and opening capsules.
- There are 5 levels. Each has an XP threshold and its own **drop list**: what one spin gives. Level 1 is today's spin reward exactly (10 wax balls plus the existing gold-ball chance, seeded from the live game config), so nothing changes for anyone until a Waypost grows, and no level gives less than the one below. These are the default levels:

  | Level | From XP (= spins) | Each spin |
  |---|---|---|
  | 1 | 0 | 10 wax, today's gold chance (5%) |
  | 2 | 100 | 12 wax, 5% chance of 1 gold |
  | 3 | 300 | 12 wax, 10% chance of 1 gold |
  | 4 | 700 | 14 wax, 20% chance of 1 gold |
  | 5 | 1500 | 15 wax, 20% chance of 1 gold, 5% chance of the city's rare vessel |

- **Drop list rules:**
  - Each item is wax, gold or a vessel, with a count range (min–max, 1–99) and a chance (1–100%).
  - Items at 100% always drop. Each other item is rolled once per spin.
  - A vessel item can name a vessel, or leave it empty to mean the city's rare Corrupted Capsule vessel. A vessel drop gives that many copies; it changes nothing for an unlimited vessel the player already owns.
- On the Waypost screen, a slim level bar sits under the name. Tapping it opens a sheet with the level, progress, what each spin drops now and at the next level, how it grows (every spin adds 1 XP), and how many times you've spun there.
- When a Waypost reaches a new level while you're at it, a short celebration shows the same plain gem with a light burst and what each spin now gives.
- **Admin:** a Waypost levels page (`/admin/levels`, under Capsules) shows every level's XP threshold and drop list. Owners and admins edit one level at a time (XP, items, note). Each change is logged in Activity with Undo. It replaces the separate spin-reward editor, because level 1 is the spin reward.

## Build split

- **Claude (UI):** everything under `mobile/` in this PR: home modes, dock, `/capsules`, the Waypost screen, the rack, doors, level bar, sheet and celebration, the admin levels page, and the dev sample in `services/waypostLevels.ts`.
- **Codex (WL1 backend):** levels table, a per-Waypost XP counter that each spin adds 1 to, spin paying from the drop list, the `waypost_level` / `admin_waypost_levels` / `admin_waypost_level_set` RPCs with Activity Undo, types, and then switching on `WAYPOST_LEVELS_BACKEND`. Its done-when is task WL1 in `docs/TASKS.md`.
- **Release order:** the UI ships first on today's backend, with levels hidden in production because the flag is off. WL1 applies its migration, then flips the flag. The client already reads an optional `vessel_awarded` from `waypost_spin`.
