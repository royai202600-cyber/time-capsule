# Dodge fight: the new capsule fight

Roy approved this direction on 2026-11-20 after playing the demo (`docs/design/demos/dodge-fight.html`; open it from a local server at the repo root, for example `python3 -m http.server 8000` then `/docs/design/demos/dodge-fight.html`). It replaces flicking a ball at a target ring.

**Who does what:** Claude plans, designs and reviews. Codex builds everything: backend, the fight screen, art, merging and release. The eight back-view player rigs were approved in PR #182.

## Where it applies

One fight screen replaces `ThrowScreen` everywhere a capsule is fought:

| Entry point | Today | With the dodge fight |
|---|---|---|
| Corrupted Capsule on Journey | One flick; ring size sets the restore chance; 3 tries | Short fight with a health bar |
| Landmark Waypost fight | 12 cracks in 180 s, gold ball = 2 cracks | Long fight: much more health, harder attacks, timer |
| Today's Hunt catch quest (`home` mode, played from anywhere) | Local flick, no balls spent | Same short fight, free throws and one aggregate quest submission |

City Hunt and private-hunt catch quests count Journey catches, so they follow automatically. The Waypost spin screen and `ThrowBackground` reuse stay as they are.

## How a fight plays

- **The camera is behind the player**, looking up the park at the capsule. The player stands at the bottom in one of **three lanes**.
- **Standing still gathers power.** A ball appears above the player's head, grows, a thin ring fills around it, specks of light drift in and it pulses faster as it fills (about 0.95 s). The player crouches slightly, snaps up and **throws automatically**. Every throw hits; there is no aiming.
- **Moving, jumping or getting hit scatters the ball** and gathering starts again. This is the whole tension: stand still to attack, move to stay safe.
- **The capsule attacks**, always with a clear warning first:
  - **Aimed shot:** a red dashed circle marks the player's lane (「← 閃開 →」), the capsule pulses dark, then a dark orb flies at that lane. Step to another lane.
  - **Double shot:** two lanes marked at once, one safe lane left.
  - **Wave:** a dark striped band at the player's feet (「↑ 往上跳！」), then a dark ring rolls across every lane. Jump.
- **Three lives**, shown as wax seals. Each hit taken costs one, the screen edge flashes red and the player blinks, safe for 1 s.
- **Boss health bar** at the top: name (「破損膠囊 · 珍珠奶茶」), bar with section ticks, a cream strip that trails each hit, and the HP number. Damage numbers float off the capsule. The cracks fade and colour returns as health drops.
- **Win:** the light burst, cracks gone, then today's restore result card (copies, stars, XP) unchanged.
- **Lose:** see Rules below.

## Rules (Roy confirmed these defaults on 2026-11-20)

| | Corrupted Capsule | Landmark fight | Today's Hunt catch |
|---|---|---|---|
| Health, in wax hits | common 3, uncommon 4, rare 5 | 20 | 3 |
| Typical length | 10–25 s | 60–100 s | 10 s |
| Timer | none | 150 s | none |
| Attacks | shot, wave; double shot after 25% damage | all three from the start, faster warnings, and a combo (wave then shot) after 50% | shot, wave |
| Ball cost | 1 ball per throw | 1 ball per throw | free |
| Gold ball | 2 damage | 2 damage (as today) | — |
| Losing (3 hits taken) | the capsule breaks free and uses one of its 3 tries; health resets next time | ends the attempt, same as time running out | the quest stays open; try again |

- **Balls:** the existing wax/gold toggle stays. When the chosen kind runs out the game switches to the other; with no balls at all, gathering stops and the player sees 「沒有蠟球了」 with the existing Waypost hint.
- **Ball skins** are looks only, separate from wax/gold (gold stays the stronger ball). How players get skins is a later decision; the first release shows only the skins a player owns, which is just the default.
- **Player figure:** the back-view layered figure from Codex's art task. The fight uses the back-view rig matching the player's portrait (01–08) and defaults to 01. The raised arm and ball share the rig's hand point. The legs swing on a step and switch to the bent pose during a jump.

## Phone and desktop

The fight must play well on both. It is portrait-shaped on both.

- **Phone:** the fight fills the screen as today, respecting safe areas. Three large buttons (← ↑ →, at least 56 px tall) sit in the thumb zone under the stage. Swiping on the stage also moves and jumps. Haptics: a tick on each throw, a warning buzz when hit.
- **Desktop and tablets:** a portrait stage centred, at most about 480 px wide and fitting the window height, with the park background extending behind it. Arrow keys, A, W, D and Space work; the buttons stay clickable and show their key (←, ↑/Space, →) only on pointer devices.
- Movement, warnings and hits must look and feel the same at 375 px and on a 1440 px desktop: positions are fractions of the stage, not pixels.
- **Pause** when the app goes to the background or the tab is hidden; resume with a short 「繼續」 tap so nobody is hit while away.
- **Reduce Motion:** no shake, no spin, no pulsing; warnings stay visible as still shapes and text.
- Both languages throughout; no hard-coded strings.

## Server (Codex)

Roy chose device-played fights on 2026-11-20. The device handles movement, throws, damage and ball counts. Journey sends one request to start and one to finish. Today's Hunt still submits the aggregate quest result only.

- **Start:** `corrupted_fight_start` and `landmark_start` check the existing location, speed and eligibility rules and record the fight's initial health, start and expiry. Landmarks have 20 HP and 150 seconds.
- **Finish:** the app submits the outcome and wax and gold totals to `corrupted_fight_finish` or `landmark_finish`. The server checks ownership, expiry, the finish location and speed, and inventory. A win requires enough damage to cover the fight's health. The attempt must have lasted at least 0.8 s per thrown ball.
- **Settlement:** the server spends both totals and applies the reward or loss in one transaction. A Corrupted loss uses one try and a Landmark loss ends the attempt. If the player runs out of balls after throwing and cannot win, the app submits a loss. With zero throws, the no-balls screen closes without submitting a result.
- **Retry:** an accepted finish stores a receipt. Repeating it returns the same result and balance. The screen offers a retry after a transport failure. Quitting or letting the fight expire without submitting spends nothing.
- **Compatibility:** `corrupted_capsule_throw` and `landmark_hit` remain callable by the flick screen. Release the app with `EXPO_PUBLIC_DODGE_FIGHT` off, apply `20261120035407`, then set the flag to `1` and redeploy.

## Work list

| ID | What | Owner |
|---|---|---|
| DF-art | Approved back-view rigs 01–08 and ball skins | Codex and Roy, PR #182 |
| DF1 | Start and finish RPCs, ball and elapsed-time checks, retry receipts; migration held for the app release | Codex |
| DF2 | The fight screen in the app for all three entry points, phone and desktop, behind `DODGE_FIGHT` | Codex |
| DF review | Review DF1 and DF2 against this plan, 375 px and desktop, both languages | Claude |
| Release | Ship with the flag off, apply DF1, then enable and redeploy | Codex, after Roy's OK |
