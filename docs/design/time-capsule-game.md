# Time Capsule: the collecting game

Status: direction agreed with Roy on 2026-11-09. Nothing is built yet. Numbers marked "to tune" get set by playing it.

This replaces the name "Public Sea" and extends [public-sea.md](public-sea.md). Where the two disagree, this doc wins.

## The idea
The game and the app are one thing, called **時光膠囊 / Time Capsule**, with no separate name for the game. It has two sides that share the same vessels, map and opening.

- **The public game:** walk around, find cracked Corrupted Capsules on the map, throw a ball to restore them, and fill your Cabinet.
- **The private side:** sealed capsules to friends or your future self, as they work today.

**What joins them:** the game gives you the rare vessels, and the private side is where they mean something. You send the vessel you found to someone you love.

**The loop:** walk → spin a Waypost for balls → throw at a Corrupted Capsule → it joins your Cabinet → send your best ones.

**"Precious in the AI age" still holds:** being somewhere and real time passing can't be faked. AI never writes anything here.

## Names
| Thing | 中文 | English |
|---|---|---|
| System capsule | 破損膠囊 | Corrupted Capsule |
| Common stop | 驛站 | Waypost |
| Landmark stop | 地標驛站 | Landmark Waypost |
| Sending to a stranger (Create step 1) | 給路過的人 | To whoever passes by |

Journey stays the name of the map tab. "Public Sea", 大海 and "bottle" wording goes.

## Corrupted Capsules
- They come from the system and hold **only the vessel**. No letter, no note, so there is nothing to write and no AI involved. Letters only ever come from real people.
- They look cracked, clouded and tarnished. This is **one shared effect** over the existing vessel art, not 67 redraws.

## Catching
- **The ball is a red wax ball**, starting point, can change later. Solid wax red, never red and white, never two halves, no band or button.
- You flick the ball up from the bottom of the screen. **The app draws the target in code, not as artwork:** a fixed white circle with an inner ring that grows and shrinks inside it. The smaller the ring when you hit, the better the result. The capsule sometimes jumps, and a ball thrown mid-jump misses.
- On a hit the ball bursts into dust, the cracks close, and the clean vessel returns. **The capsule is never pulled inside the ball.**
- **It has its own simple background:** a generic street scene in the live map's colours and flat style, not a real place. No painted scenes and no camera view.
- **Two items only:** Wax Ball, and Gold Wax Ball (makes a hit easier). Nothing else: no berries, keys, charms, shards or crafting.

## How Corrupted Capsules are released
- **The server decides, never the phone.**
- **Fixed spots** from public map data: parks, squares, waterfronts. Never roads, schools, places of worship or private property.
- **Waves:** new capsules about every hour, staying 30–60 minutes (to tune).
- **You only see Corrupted Capsules inside your pickup circle**, so they never crowd the map. Wayposts and bottles still show further out.
- **Everyone nearby sees the same capsule and each catches their own copy.** Two friends walking together both get it.
- **Real time and place decide what appears.** The firefly jar only after dark, the Mid-Autumn lantern only at Mid-Autumn, the bottle by the water. Common vessels can appear anywhere.

## The map
The default zoom makes the 100 m pickup circle span 75% of the screen width.

## Wayposts
- **Common Waypost:** a small floating purple gem on the map, with no pole. Tap it and the same gem appears large; swipe to turn it. Balls rise and fade, with a tally such as +4 at the top right, then a cooldown. No photos of real places.
- **Only capsules are detailed illustrated objects.** Wayposts stay simple, so nobody confuses one with a capsule.
- **Landmark Waypost:** on the map it is a larger, deeper purple gem, and never a capsule. The giant, badly cracked Corrupted Capsule only appears once you start the fight. Throw balls to close the cracks before time runs out.
  - **Beatable alone for now.** Friends making it easier comes later.
  - **No lucky final catch.** Clear the cracks and the landmark vessel and Passport stamp are yours.
  - Opening a capsule at a landmark **also** still earns its vessel, as it does today.
- **Sacred sites** (Sensō-ji, Fushimi Inari, the Grand Palace): no boss on the grounds. Use a suitable public spot nearby or a gentler version. These are outside the first three cities, so this is decided when we get there.
- **Skipped:** teams, and taking over Wayposts. Group raids come later, once there are enough players.

## Levels
- **You:** one XP level on your existing portrait. No 3D character. The most XP comes from opening a real capsule, and more the longer it waited, so a one-year capsule beats any amount of catching.
- **Vessels:** 1–5 stars, raised by collecting duplicates.

## Collection
- **Cabinet shows only what you have.** No outlines of anything missing.
- **Capsule Album (膠囊圖鑑) is the collection book:** a separate page listing every vessel in number order. Collected ones show their picture, number and name; uncollected ones are a plain number card. Open it from the bottom right of Journey or from the Cabinet.
- **Passport stays**, and landmark stamps go in it. On Journey it is a recognisable icon at the bottom of the screen, not a bare count.

## Shop and sending
- **Collecting is the main way to get vessels.** The Shop sells only what can't be found: brand and numbered editions. It stays free while testing.
- **You can send what you've collected, plus the four starter vessels** every new player gets: blue rose dome, bottle, wax-sealed letter and tin. Other free vessels have to be found too.
- Writing to someone never costs balls. The game must never block a letter.

## Capsules from strangers
Today's rules stay, under the new name:
- Same Create flow, typed letters only, sender's profile visible.
- **Always a bottle, all the same size on the map**, so it can never be mistaken for a Corrupted Capsule. Capsules to friends keep the vessel you chose.
- Shown at a public Waypost, never the sender's real spot. Drift time of 1, 7, 30 or 365 days.
- One finder within 100 m (server-checked). **You just pick it up: no throwing at a person's letter.**
- No daily pick-up limit (Roy removed it on 2026-11-08).
- Report hides it at once; 2 reports hide it from everyone until reviewed.

## Where it launches
**Taipei, Singapore and Macau**, all already in our map tiles. One Landmark Waypost each to start: Taipei 101, the Merlion, Senado Square. Taipei 101 and the Merlion are trademarks, so their vessels stay loosely inspired and are earned, never sold.

The 6 or so shores per city are too few, so we add Wayposts from public map data until busy areas have one every few minutes' walk.

The test location stays until launch and extends to all three cities for test accounts. It is removed before real users.

## Rules that don't change
- AI never writes letters or capsule content.
- No leaderboards.
- No paying for random prizes, and no paying to skip the wait.
- No streak you can lose. A bonus for the first catch of the day is fine.
- Location is checked on the server, with added checks against impossible travel, because GPS cheating matters much more once there is something to win.
- Sealed means sealed.
- **It must be an original game.** Pokémon GO is a genre reference only: no names, creatures, art or look.

## To remove or change first
- Remove the illustrated Asia map from Journey (Passport stays).
- Rename Public Sea, 大海 and bottle wording everywhere on screen. Database names can stay as they are.
- Replace the sea portrait and sea sealed scene, which no longer fit.

## Who does what
| Who | Does |
|---|---|
| **Claude, main planning session** | Plans, designs and builds screens on `claude/` branches, reviews reports, writes Codex prompts for backend, merging, deploying and anything else |
| **Claude, art session** | A separate session that reads `design/art/STYLE.md` and writes the art prompts for Codex. Art only |
| **Codex** | Generates art with `gpt-image-2`, builds backend, wires data, merges, deploys. Each parallel session has its own branch and worktree |
| **Roy** | Decides, picks art, relays between sessions and Codex, tests on his phone at the end |

## Proposed build order (needs Roy's OK)
Art, screens and backend can run in parallel once this doc is confirmed.
1. **Cleanup:** remove the old map and rename Public Sea.
2. **Art:** final ball, cracked effect, Waypost building, spinning object, giant capsule.
3. **Backend:** release system, Wayposts, balls, catching, XP and stars, cheating checks, Shop and sending rules.
4. **Screens:** throw on the map, Waypost spin, Landmark fight, numbered Cabinet, level display.

## Open questions
1. How the Waypost building and its spinning object look (art to show Roy).
2. The final red wax ball design, and whether the Gold Wax Ball is a colour change or a new look.
3. What replaces the sea portrait and sea sealed scene.
4. What happens to vessels testers already took for free from the Shop.
5. Numbers to tune: spawn rate, balls per spin, Waypost cooldown, Landmark time limit, XP curve, duplicates per star.
6. Whether a daily pick-up limit should return once strangers are real users.

Still needed before real users, from earlier: a domain and email provider, moving map tiles off the pilot `r2.dev` address, in-app account deletion, and removing the test location and the ten test bottles.
