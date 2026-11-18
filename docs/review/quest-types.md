# HL-C3 shared quests and question pool

## Player contract

`city_hunt_quests({ hunt_id })` returns a JSON array after Keeper check-in. Private-hunt player payloads expose the same array as `quest_objects`, including locked pins when previewing a valid invite. The existing `quests` array retains its legacy fields and location-free restore rows, and it remains empty before joining. After joining, its located entries also carry the shared fields.

```ts
type Quest = {
  quest_id: string
  ordinal: number
  type: "arrive" | "question" | "price" | "catch" | "landmark"
  location_lat: number
  location_lng: number
  name_zh: string
  name_en: string
  image: string | null
  points: number
  done: boolean
  locked: boolean
  question?: {
    kind: "choice" | "text"
    prompt_zh: string
    prompt_en: string
    choices?: { zh: string; en: string }[]
  }
  price?: {
    place_zh: string
    place_en: string
    prompt_zh: string
    prompt_en: string
    currency: string
    rate: number
    tries_left: number
  }
  catch_count?: number
  landmark_id?: string
}

type QuestAttempt = {
  quest_id: string
  lat: number
  lng: number
  accuracy: number
  answer?: { choice?: number; text?: string; usd?: number; qr?: string }
}

type QuestResult = {
  ok: boolean
  done: boolean
  points: number
  hint?: "higher" | "lower"
  tries_left?: number
  correct_answer?: { choice: number } | { text: string } | { usd: number; local_amount: number }
}
```

Call `city_hunt_quest_attempt({ payload })` or `private_hunt_quest_attempt({ payload })`. Choice indexes start at zero. Price guesses are in USD. The rate is units of local currency per USD. The exact local price arrives on success or after the third miss. The third miss completes the price quest with `ok:false, done:true, points:0, tries_left:0` and `correct_answer`. Subsequent attempts return `already_done`. Questions remain incomplete after three misses and return `no_tries` during their 60-second cooldown. For a private GPS + QR arrival, send the organizer token or printed deep link in `answer.qr`.

A catch attempt near the pin activates private releases containing `quest_id` in `game_nearby.spawns`. Submit `spawn_id` to the existing throw RPC and refresh quests after a restoration. Releases use the city's active wave pool, rarity weights and habitat and time rules. They award copies through HL-C2's normal catch path. Activating a pin without an eligible city spawn pool returns the existing `bad_rule` error. A Landmark attempt checks location and order, then the existing fight RPCs handle the fight. Refresh quests after winning. A valid activation returns `ok:true, done:false, points:0`.

## Organizer and admin contracts

The organizer uses `private_hunt_quest_save(p_hunt,p_quest)`. The matching editor state includes the selected `pool_id` and safe quest metadata. Existing `arrive` and `puzzle` editor payloads remain supported. New inputs use `type` or `quest_type` with the usual `ordinal`, `points`, `name`, and optional `id` and `image`. Pool questions and prices use `pool_id` and inherit the pool location. Catch supplies coordinates and optionally `catch_count`. Landmark supplies the proposed coordinates and optionally `landmark_id`. The server snaps a qualifying pin to the visible Landmark Waypost.

`admin_question_pool_list(city,filter,cursor)` returns up to 50 `items` and a nullable `next_cursor`. Filters are `all`, `draft`, `published`, `hidden` and `needs_recheck`. Items include `uses` and `needs_recheck`. A no-location entry is visible to staff but cannot be attached to a quest.

`admin_question_pool_save(payload)` adds or patches metadata and grading inputs. Use `answer` as a zero-based index or text, and `typed_aliases` for additional text matches. For a price, enter `local_amount`, `currency` and `rate`. The server rounds USD to cents. The response, list, and public activity stream omit grading data. Status changes through `admin_question_pool_set_status(id,status)`. Undo uses `admin_undo` and restores the prior metadata and grading input when the action is still current.

The 80 CE1 questions enter the pool with null coordinates. CE1 keeps its original rotation and records so edits to the new pool cannot change old plays or daily RPC responses. Quest rules snapshot pool data so later admin edits do not rewrite an existing hunt.

## Existing SQL definitions replaced

- `public.admin_undo` delegates actions outside the question pool before checking the editor role. HL-C1 can still authorize moderator rack Undo, and HL-C2 keeps its own checks.
- `public.private_hunt_quest_save` delegates the two compatible editor formats to its previous implementation.
- `private.private_hunt_player_object` builds the shared objects and the compatible payload.
- `public.private_hunt_edit_state` returns the pool selection and quest metadata to the organizer.
- `public.private_hunt_quest_complete` refuses new rules on the old endpoint.
- `public.game_nearby` adds only the caller's quest releases.
- `public.corrupted_capsule_throw` uses the merged HL-C2 definition and adds quest-release validation and progress. Copies and compatibility stars use the normal HL-C2 award path.
- `private.city_hunt_record_quest` credits the existing Landmark win to eligible quests.
- `public.city_hunt_finish` checks located quests for runs using the new attempt RPC and the legacy counters for older apps.

The shared migration also extends the pool usage helper introduced in checkpoint 1.

## Proposed City Hunt pins

The Keeper checks the player in, starts the existing timer and gives the reward. All five pins appear after check-in. Each route uses three visits, five Corrupted Capsule catches at one outdoor pin, and the existing Landmark as the last quest. The first Arrive pin is at least 200 m from the Keeper. The coordinates come from the live Wayposts and the seed checks that each Waypost is visible, game enabled and inside its hunt area.

| Order | Type | Xinyi | Senado | HKUST |
|---|---|---|---|---|
| 1 | Arrive | Xiangti Avenue Square (430 m from Keeper) | Ferreira do Amaral Square (508 m) | Fong Shu Chuen Promenade (273 m) |
| 2 | Arrive | Songshou Square | Arts Garden | LG7 Lawn South |
| 3 | Arrive | Songzhi Park | Vasco da Gama Garden | HKUST Piazza East |
| 4 | Catch ×5 | Xinyi 21 Plaza | Mount Fortress Park | HKUST Piazza North |
| 5 | Landmark | Taipei 101 | Senado Square fountain | HKUST Entrance Piazza |

For runs active at rollout, existing spin credits account for the first one, two or three Arrive pins. Existing catch and Landmark progress also carries forward. New progress belongs to the current check-in and resets with it. Old apps may finish through the original spin, catch and Landmark counters. Finishing the located route still requires returning to the Keeper and uses the same reward and Passport stamp path.

## Running the checks

Hosted rollback runs C2 `20261118123808` from `ec7cf1c` and C1 `20261118124925` from `4432006`, in that order, with their outer transaction markers removed. The same transaction then runs `question-pool-before.sql`, the three C3 migrations, `question-pool.sql`, `shared-hunt-quests.sql`, `located-city-hunts.sql`, `quest-types-integration.sql`, and C1's `hunt-racks.sql` from the same commit. The assertions cover CE1 response equality, moderator rack Undo and question pool Undo, private and City Hunt price exhaustion, quest catch copies, an unlimited starter catch, and the full hunt and legacy compatibility checks. The last statement rolls everything back.

`node supabase/tests/shared-quest-api.mjs` exercises authenticated calls with sessions issued by GoTrue. It targets the disposable `tc_quest_types_verify` database and its two test containers on the existing Docker network.
