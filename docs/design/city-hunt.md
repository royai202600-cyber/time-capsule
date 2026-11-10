# City Hunt, the Letter Keeper and map characters

Status: design agreed with Roy on 2026-11-10. The first hunt is in Xinyi, Taipei, around Taipei 101, and Roy tests it. This extends [time-capsule-game.md](time-capsule-game.md); where the two disagree, this doc wins.

## Why
A **City Hunt** (城市尋寶) is a scheduled event in one area. People join, meet the Letter Keeper, walk a route of Wayposts, restore Corrupted Capsules, win the Landmark fight and come back to him. It gives people a reason to come out at the same time and bring friends, which is how we get more players.

Nothing new is invented for it. It **combines what already exists**:

| Piece | Its role in a hunt |
|---|---|
| Letter Keeper (NPC) | Gives the quest at the start and ends it |
| Wayposts | Stops along the route |
| Corrupted Capsules | Whatever is nearby, restored for a fixed number |
| Landmark Waypost | The final fight |
| Quest button | Where you join and see your steps |

## Rules that still hold
- No leaderboards or ranking. Everyone who finishes gets the same reward, and nobody sees who finished first.
- No streaks, no paying to skip a step, no random prizes for money.
- The server checks every step and every location.
- **Other players never appear on the map**, not even during a hunt. Nobody's live location is shown to strangers.
- AI writes nothing. The Letter Keeper's lines are set text in both languages.

## The Letter Keeper (守信人 / the Letter Keeper)
- **One NPC, only during a hunt.** He stands at the hunt's starting point while it is open and nowhere else. He does not wander and does not teach new players outside hunts.
- Based on Codex's sketch A1 (cap, navy jacket, cream satchel). The art session finalises him as a map figure plus a round portrait for his dialog.
- **Marker over his head:** a small brass wax seal that floats and pulses, drawn in code, never generated.
  - **!** — he has a quest for you (not joined, or joined but not checked in).
  - nothing — you are on the hunt and steps remain.
  - **✓** — all steps are done; come back to him.
- **Tapping him** opens a dialog card: his portrait in a brass rim, his line, and one button. On the map he is a person, so he can't be confused with a capsule (objects) or a Waypost (gems).

### His lines (zh / en)
| When | 中文 | English |
|---|---|---|
| Before you join | 我在這裡守著一些信。今天的城市裡有些膠囊破了，願意幫我走一趟嗎？ | I look after letters here. Some capsules in the city cracked today. Will you walk a route for me? |
| Button | 加入尋寶 | Join the hunt |
| Joined, not here yet | 我在市府廣場等你。到了再跟我說一聲。 | I'm waiting at Civic Square. Come and find me when you're here. |
| Check-in | 好，路線在地圖上了。轉三座驛站、修好五個膠囊，最後去101。 | Good, the route is on your map. Spin three Wayposts, mend five capsules, then go to 101. |
| Button | 出發 | Let's go |
| During | 慢慢走，膠囊不會跑掉。 | Take your time. The capsules aren't going anywhere. |
| All done | 你都修好了。這枚印章是你的。 | You mended them all. This stamp is yours. |
| Button | 收下 | Take it |
| Already finished | 謝謝你今天走這一趟。下次尋寶見。 | Thank you for walking with me today. See you at the next hunt. |

## The first hunt: Xinyi, Taipei
- **Name:** 信義城市尋寶 / Xinyi City Hunt (`xinyi-2026-11`).
- **Open:** from its release until **2026-11-30 23:59 Asia/Taipei**, so Roy can test it any time. Later hunts are short windows, for example a Saturday 14:00–17:00.
- **Letter Keeper:** Taipei City Hall Civic Square (25.037546, 121.562754). This is also the test account's simulated location, so Roy starts right next to him.
- **Hunt area:** a 1,200 m circle around Taipei 101 Plaza (25.033263, 121.564887). It covers every stop below.
- **Suggested route** (any Waypost in the area counts; these are the nearby ones, measured; about 2–2.5 km, 40–60 minutes):

| Stop | Kind | From Civic Square | From 101 Plaza |
|---|---|---|---|
| Civic Square | Letter Keeper | — | 522 m |
| Xiangti Avenue Square 香緹大道廣場 | Waypost on the route | 430 m | 515 m |
| Xinyi 21 Plaza 信義21號廣場 | Waypost on the route | 356 m | 168 m |
| Songren Green 松仁綠地 | Waypost on the route | 738 m | 282 m |
| Zhenghe Park 正和公園 | Waypost on the route | 390 m | 644 m |
| Jinglian Plaza 景聯廣場 | Waypost on the route | 634 m | 486 m |
| Taipei 101 Plaza | Landmark Waypost | 522 m | — |

### Steps
| # | Step | Goal | Counts when |
|---|---|---|---|
| 1 | Meet the Letter Keeper | check in | within the action radius of him, inside the window |
| 2 | Spin Wayposts in the area | 3 different ones | a successful spin of any Waypost inside the hunt area (Roy, 2026-11-10) |
| 3 | Restore Corrupted Capsules | 5 | a successful catch of any Corrupted Capsule inside the hunt area |
| 4 | Win the Landmark fight | 1 | a win at Taipei 101 Plaza (a repeat win counts too) |
| 5 | Return to the Letter Keeper | finish | steps 2–4 complete, back within his action radius |

Steps 2–4 can be done in any order, and only count **after** check-in and **before** the window closes. Capsules are whatever is around, as Roy decided: there is no special hunt vessel, and every capsule restored is kept as usual.

### Reward
- **A City Hunt stamp in the Passport** (one stamp per hunt, new art).
- **5 Gold Wax Balls and +300 XP** (to tune).
- Nothing ranked and nothing random. Seasonal or special hunt vessels can come later.

## Screens (Claude)
- **Journey bottom row becomes Passport · Quest · Cabinet.** The Album button goes, since the Cabinet already opens the Album and Journey had no way to reach the Cabinet.
- **Quest button:** a code-drawn rolled scroll with a brass seal. A wax-red dot appears when a hunt is open that you haven't joined.
- **Quest sheet:**
  - No hunt open: the next scheduled hunt (name, place, date and countdown), or "No hunt scheduled yet."
  - Open, not joined: name, place, time left, the reward, and **Join**.
  - Joined: the five steps as a checklist with counts (2/3, 4/5), the time left, and **Show on map**.
  - Finished: the stamp and "Finished".
- **On the map during a hunt** (for players who joined): the Letter Keeper with his marker and Taipei 101 as usual. Every Waypost looks the same, with no ring, and any Waypost inside the area counts (Roy, 2026-11-10). Players who haven't joined still see him with **!** when they are nearby.
- **Wayposts by colour:** **ink blue `#2F5D8A`** when you can spin it, and **purple** (today's colour) during its cooldown after you spin. This replaces today's fading. Landmarks follow the same rule but stay larger.
- **Passport:** a "City Hunts" section for hunt stamps, below the place stamps.
- **Toy-scale city (Roy, 2026-11-10):** map buildings are drawn at 35% of their real height and never above 40 m, so tall towers never wall off the pickup circle.
- **Landmarks are monuments, not gems (Roy, 2026-11-10):** each Landmark is drawn at its real spot as stacked boxes in brass fading to cream. No Waypost or Landmark has a ring on the ground (Roy, 2026-11-10). Taipei 101 is a wide base, eight stepped sections, a crown and a spire, about 140 m tall in map terms. It is plain map geometry, with no art file or 3D model. **The building is the Landmark Waypost:** tapping the tower opens its fight, and its seal badge (a 28 px brass seal with a four-point star, the same on every Landmark) floats just above the spire, turning plum once beaten. Taipei 101 stands at its real centre, 25.033667, 121.564810 (the spire axis in the OSM building data of our map tiles; Wikipedia agrees to within about 20 m), and the server's Landmark point moves there too. Landmarks without a monument show only the floating badge. The Merlion and Senado Square get low, wide versions when hunts reach them.

## Your map character (Claude screens, art session art)
- **Two separate things:**

| | Profile picture | Map character |
|---|---|---|
| Who sees it | Other people (letters, bottles, Friends) | Only you, on Journey |
| What it is | Illustrated portrait now, your uploaded photo later | Always an illustrated full-body figure |

- **Eight figures, one per pickable portrait (01–08; art in PR #92).** Picking portrait 03 gives you figure 03. The portrait picker shows each face with its figure, and Me shows your figure.
- **Uploading a photo later changes only the profile picture.** You keep your figure. No AI cartoon of anyone's photo. People with an old SVG avatar get figure 01 until they choose a portrait.
- **On the map:** your figure replaces the round face, standing at the centre on the existing pulse and heading cone. A gentle bob while you move, flipped to face left or right. (The level stays in the top chip; no badge at the feet, to keep the figure clean.)
- **First visit to Journey:** a small label, 「這是你」 / "This is you", appears over your figure for about three seconds, fades by itself, and never shows again (Roy, 2026-11-10).
- **Later, not now:** outfits as level rewards (Codex's B1 jacket, B2 hoodie and B3 coat fit).

## Art (art session → Codex, `gpt-image-2`, following `design/art/STYLE.md`)
1. **Letter Keeper:** the final full-body map figure from sketch A1, plus a round dialog portrait cut with the standard portrait mask.
2. **Nine player figures,** one matching each `portrait-01` … `portrait-09` (same person, face, hair and skin), on one shared body scale. Test three first for Roy.
3. **Blue Waypost and Landmark gems:** recolour the existing gems to ink blue by script, keeping the purple files for the spun state. Check them against water on the map.
4. **Xinyi City Hunt Passport stamp,** following the stamp rules.

Map figures: 1024×1024 transparent, feet on a common anchor at (512, 900), full body visible, readable at 64–120 px tall.

## Backend contract (Codex)
The screens are built against this shape with a dev fallback, the same pattern as `mobile/src/services/game.ts`.

- `hunt_list(p_lat, p_lng)` → jsonb array of open and upcoming hunts, each:
  `{ id, name_zh, name_en, city_zh, city_en, starts_at, ends_at, keeper: { lat, lng }, area: { lat, lng, radius_m }, landmark: uuid, reward: { xp, gold }, steps: [{ key: "checkin"|"spin"|"restore"|"landmark"|"return", goal, count }], joined_at, checked_in_at, finished_at }`
- `hunt_join(p_hunt)` → the same hunt object. Allowed from anywhere before the window closes.
- `hunt_check_in(p_hunt, p_lat, p_lng, p_accuracy)` → hunt object; within the action radius of the keeper, inside the window.
- `hunt_finish(p_hunt, p_lat, p_lng, p_accuracy)` → `{ hunt, xp_gained, gold_gained, state }`; steps 2–4 complete, at the keeper, inside the window, once only.
- `waypost_spin`, `corrupted_throw` (successful catch) and `landmark_hit` (`won`) add hunt progress server-side when the rules above match. Hunt bookkeeping must never make the original action fail.
- `my_passport()` also returns hunt stamps, with `how_earned = 'hunt'`.
