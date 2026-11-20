# Dodge fight: the new capsule fight

Roy approved this direction on 2026-11-20 after playing the demo (`docs/design/demos/dodge-fight.html`; open it from a local server at the repo root, for example `python3 -m http.server 8000` then `/docs/design/demos/dodge-fight.html`). It replaces flicking a ball at a target ring.

**Who does what:** Claude plans, designs and reviews. Codex builds everything: backend, the fight screen, art, merging and release. Art for the back-view player and ball skins is already in progress with Codex (`codex/art-fight-player`).

## Where it applies

One fight screen replaces `ThrowScreen` everywhere a capsule is fought:

| Entry point | Today | With the dodge fight |
|---|---|---|
| Corrupted Capsule on Journey | One flick; ring size sets the restore chance; 3 tries | Short fight with a health bar |
| Landmark Waypost fight | 12 cracks in 180 s, gold ball = 2 cracks | Long fight: much more health, harder attacks, timer |
| Today's Hunt catch quest (`home` mode, played from anywhere) | Local flick, no balls spent | Same short fight, no balls spent, nothing sent to the server per throw |

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
- **Player figure:** the back-view layered figure from Codex's art task. The fight uses the figure matching the player's chosen portrait (01–08). Until all eight are approved, the release waits; development may use the front figures.

## Phone and desktop

The fight must play well on both. It is portrait-shaped on both.

- **Phone:** the fight fills the screen as today, respecting safe areas. Three large buttons (← ↑ →, at least 56 px tall) sit in the thumb zone under the stage. Swiping on the stage also moves and jumps. Haptics: a tick on each throw, a warning buzz when hit.
- **Desktop and tablets:** a portrait stage centred, at most about 480 px wide and fitting the window height, with the park background extending behind it. Arrow keys, WASD and Space work; the buttons stay clickable and show their key (←, ↑/Space, →) only on pointer devices.
- Movement, warnings and hits must look and feel the same at 375 px and on a 1440 px desktop: positions are fractions of the stage, not pixels.
- **Pause** when the app goes to the background or the tab is hidden; resume with a short 「繼續」 tap so nobody is hit while away.
- **Reduce Motion:** no shake, no spin, no pulsing; warnings stay visible as still shapes and text.
- Both languages throughout; no hard-coded strings.

## Server (Codex)

Today the client reports `p_hit` and `p_ring`, and a Corrupted Capsule restores on one lucky hit. The new fight needs health:

- **Corrupted:** a fight row per player and spawn with health from rarity. Each throw RPC spends one ball, applies damage, and restores the capsule at zero health. A loss RPC uses one try. Ring and the restore chance retire.
- **Landmark:** keep `landmark_attempts`. `landmark_cracks` becomes the health (20) and `landmark_seconds` the timer (150); `landmark_hit` stops reading `p_ring`. A loss ends the attempt.
- **Cheating checks:** at least 0.8 s between throws in the same fight (just under the gather time), the existing distance and speed checks, and fights expire. Dodging is played on the device; the server only sees throws and a loss.
- Keep old RPCs working until the old app is gone, as with earlier releases.

## Work list

| ID | What | Owner |
|---|---|---|
| DF-art | Back-view layered player 01 (then 02–08) and ball skin tests | Codex (in progress), Roy approves |
| DF1 | Fight health, throw/loss RPCs, Landmark numbers, cheating checks; migration held for the app release | Codex |
| DF2 | The fight screen in the app for all three entry points, phone and desktop, behind `DODGE_FIGHT` | Codex |
| DF review | Review DF1 and DF2 against this plan, 375 px and desktop, both languages | Claude |
| Release | One combined release: app first, then the migration, as with the hunt loop | Codex, after Roy's OK |
