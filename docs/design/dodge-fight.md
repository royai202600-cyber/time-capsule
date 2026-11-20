# Dodge fight: the new capsule fight

Roy approved this direction on 2026-11-20 after playing the demo (`docs/design/demos/dodge-fight.html`; open it from a local server at the repo root, for example `python3 -m http.server 8000` then `/docs/design/demos/dodge-fight.html`). It replaces flicking a ball at a target ring.

**Who does what:** Claude plans, designs, builds the fight screen and other UI, and reviews. Codex does the backend, art, merging and release. (Corrected 2026-11-20: Codex built DF2's screen by mistake; from DF3 on, the UI is Claude's.) The eight back-view player rigs were approved in PR #182.

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
  - **Aimed shot:** a red dashed circle marks the player's lane, the capsule pulses dark, then a dark orb flies at that lane. Step to another lane.
  - **Double shot:** two lanes marked at once, one safe lane left.
  - **Wave:** the capsule rears up and the demo's dark striped band, labelled 「↑ 往上跳！」, pulses across the ground at the player's feet. Then a glowing plum ring spreads from under the capsule to every lane. Jump.
  - **Triple shot:** all three lanes marked, with a longer glow, and all three fire together. It can't be dodged or jumped (Roy, 2026-11-20: a rare "nowhere to go" moment is fun). It never comes on the last life, and at most once per Corrupted Capsule / Today's Hunt fight and twice per Landmark fight.
  - Warnings keep their short text: 「← 閃開 →」 above the red circle, 「↑ 往上跳！」 under the player for the wave, and one 「撐住！」 / “Brace!” for the triple. The control buttons show only arrows, no words. Screen readers still hear each attack.
- **Attack mix:** weighted random, never the same attack three times running. Early means the first 40% of damage; rare capsules use the late table from the start.

  | | early | late | Landmark |
  |---|---|---|---|
  | Single shot | 50 | 35 | 30 |
  | Double shot | 20 | 25 | 25 |
  | Wave | 25 | 25 | 30 |
  | Triple shot | 5 | 15 | 15 |

- **Hit text and sounds:** a capsule hit shows 「命中了！」「很好！」 or 「漂亮！」 at random; a hit taken shows 「被打中了」. Sound effects (no voices): whoosh on throw, crack on a capsule hit, thump on a hit taken, a chime on win. Warnings have no sound, so a sound always means something landed. They follow the Me sound-effects switch.
- **How-to card:** only on a player's first fight on the device. Later fights start at once with a short 「準備…」; the 「?」 button reopens the card and pauses.
- **Three lives**, shown as wax seals. Each hit taken costs one, the screen edge flashes red and the player blinks, safe for 1 s.
- **Boss health bar** at the top: name (「破損膠囊 · 珍珠奶茶」), bar with section ticks, a cream strip that trails each hit, and the HP number. Damage numbers float off the capsule. The cracks fade and colour returns as health drops.
- **Win:** the light burst, cracks gone, then today's restore result card (copies, stars, XP) unchanged.
- **Lose:** see Rules below.

## Rules (Roy confirmed these defaults on 2026-11-20)

| | Corrupted Capsule | Landmark fight | Today's Hunt catch |
|---|---|---|---|
| Health, in wax hits | common 5, uncommon 6, rare 7 (Roy, 2026-11-20) | 20 | 5 |
| Typical length | 15–30 s | 60–100 s | 15 s |
| Timer | none | 150 s | none |
| Attacks | the early/late mix above | the Landmark mix, faster warnings, and a combo (wave then shot) after 50% | the early/late mix |
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
- **Stock:** Start requires enough wax and gold to cover the fight's full health. The app shows the wax-ball requirement and Waypost hint when the player falls short.
- **Finish:** the app submits the outcome and wax and gold totals to `corrupted_fight_finish` or `landmark_finish`. The server checks ownership, expiry, the finish location and speed, and inventory. A win requires enough damage to cover the fight's health. The attempt must have lasted at least 0.8 s per thrown ball. A Corrupted fight started before its spawn expired can finish in the next 60 seconds.
- **Settlement:** the server spends both totals and applies the reward or loss in one transaction. A Corrupted loss uses one try and a Landmark loss ends the attempt. If the player runs out of balls after throwing and cannot win, the app submits a loss. With zero throws, the no-balls screen closes without submitting a result.
- **Leaving:** after the first throw, leaving a Journey fight through the close button asks for confirmation and submits a loss with the balls thrown. Before the first throw and in Today's Hunt, the close button exits immediately. Backgrounding pauses play.
- **Retry:** an accepted finish stores a receipt. Repeating it returns the same result and balance. The screen offers a retry after a transport failure.
- **Compatibility:** `corrupted_capsule_throw` and `landmark_hit` remain callable by the flick screen. Release the app with `EXPO_PUBLIC_DODGE_FIGHT` off, apply `20261120035407`, then set the flag to `1` and redeploy.

## Work list

| ID | What | Owner |
|---|---|---|
| DF-art | Approved back-view rigs 01–08 and ball skins | Codex and Roy, PR #182 |
| DF1 | Start and finish RPCs, ball and elapsed-time checks, retry receipts; migration held for the app release | Codex |
| DF2 | The fight screen in the app for all three entry points, phone and desktop, behind `DODGE_FIGHT` | Codex |
| DF review | Review DF1 and DF2 against this plan, 375 px and desktop, both languages | Claude |
| Release | Ship with the flag off, apply DF1, then enable and redeploy | Codex, after Roy's OK |

## Simplified fight (DF3, Roy approved 2026-11-20)

Roy's colleague found the fight hard to pick up. This keeps the look and the attacks and only simplifies how you play. Roy approved it after playing the demo: `docs/design/demos/dodge-fight-simple.html` (its top row of switches is for the demo only). Where this section differs from the sections above, this section wins.

- **Moving:** no buttons and no ball panel under the fight. Hold anywhere and drag, as in Survivor: Ace; the figure stays in the same three areas and snaps to the next one for about every quarter screen you drag. A quick flick up jumps. On a computer, each arrow key press moves one area and Space jumps. The first-fight card teaches this.
- **Throwing:** one ball every second, whether you move or not. Standing still to gather is gone. Each ball still hits for 1 (gold 2), so balls spent still equal the damage dealt.
- **Aim:** unchanged. A shot aims at your area, and a double also hits one other area and always leaves one safe. The triple stays unavoidable and never takes the last life.
- **Health:** a small capsule bar sits right under the capsule and a small blue player bar under the figure's feet (three sections), instead of the big top bar and the wax seals. Each is one smooth bar with no section lines, shows only the number left (such as 4), and turns from green to red as it drops.
- **Today's Hunt:** the three capsules are numbered 1, 2, 3 down the left side. A number is grey until that capsule is restored and blue once it is; the current one has a blue ring. Each is its own fight with full health, and the next drops in without leaving the screen.
- **Jump attack:** nothing travels from the capsule. During the warning (the striped band and 「↑ 往上跳！」) nothing else shows; at the hit moment spikes burst up from the ground at the player's feet, hold briefly and sink back. No crack (Roy found it strange). Art: PR #188, faceted option B (Roy chose B on 2026-11-20).
- **Throwing motion:** the whole body throws, like an overhand pitch seen from behind: cock (short step, ball behind the head) 140 ms before the ball leaves, then release 80 ms, follow-through 150 ms and recover 130 ms, then the rest pose. Each pose is split at the waist, so the upper body also plays over the jump legs. The ball shows in the hand only during the cock pose, at 80% of the flying ball's size (Roy chose −20%), and leaves from the release pose's ball point. Load all four poses for the player's figure before the fight starts and switch which one is visible; swapping one image's source mid-throw skips frames that haven't decoded yet. Art: PR #189 (fight-0X-throw-1…4-upper/lower).
- **Health doubles so fights last as long as today.** Measured with a bot that dodges everything, the current fight throws about every 1.9–2.1 s (common about 9.6 s, Landmark about 42 s). Throwing every second with twice the health keeps that length: Corrupted common 10, uncommon 12, rare 14, Today's Hunt 10 each, Landmark 40 in 150 s. Balls spent per fight double too (a common capsule takes 10 wax balls or 5 gold), so Waypost spin rewards may need to rise to match. Roy raised a common Waypost spin to 10 wax balls (from 3–5) and asked for the amount to be editable in admin, next to the wave settings, with Activity Undo.
- **Later:** Archero-style choice cards now and then during Landmark fights. Not designed yet.
