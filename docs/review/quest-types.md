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

Call `city_hunt_quest_attempt({ payload })` or `private_hunt_quest_attempt({ payload })`. Choice indexes start at zero. Price guesses are in USD. The rate is units of local currency per USD. The exact local price arrives with the successful answer. A wrong submission returns `ok:false`; after the third failure further submissions return the RPC error `no_tries`. Questions can be retried after 60 seconds. Price tries last for the run. For a private GPS + QR arrival, send the organizer token or printed deep link in `answer.qr`.

A catch attempt near the pin activates private releases containing `quest_id` in `game_nearby.spawns`. Submit `spawn_id` to the existing throw RPC and refresh quests after a restoration. A Landmark attempt checks location and order, then the existing fight RPCs handle the fight. Refresh quests after winning. A valid activation returns `ok:true, done:false, points:0`.

## Organizer and admin contracts

The organizer uses `private_hunt_quest_save(p_hunt,p_quest)`. Existing `arrive` and `puzzle` editor payloads remain supported. New inputs use `type` or `quest_type` with the usual `ordinal`, `points`, `name`, and optional `id` and `image`. Pool questions and prices use `pool_id` and inherit the pool location. Catch supplies coordinates and optionally `catch_count`. Landmark supplies the proposed coordinates and optionally `landmark_id`. The server snaps a qualifying pin to the visible Landmark Waypost.

`admin_question_pool_list(city,filter,cursor)` returns up to 50 `items` and a nullable `next_cursor`. Filters are `all`, `draft`, `published`, `hidden` and `needs_recheck`. Items include `uses` and `needs_recheck`. A no-location entry is visible to staff but cannot be attached to a quest.

`admin_question_pool_save(payload)` adds or patches metadata and grading inputs. Use `answer` as a zero-based index or text, and `typed_aliases` for additional text matches. For a price, enter `local_amount`, `currency` and `rate`. The server rounds USD to cents. The response, list, and public activity stream omit grading data. Status changes through `admin_question_pool_set_status(id,status)`. Undo uses `admin_undo` and restores the prior metadata and grading input when the action is still current.

The 80 CE1 questions enter the pool with null coordinates. CE1 keeps its original rotation and records so edits to the new pool cannot change old plays or daily RPC responses. Quest rules snapshot pool data so later admin edits do not rewrite an existing hunt.

## Existing SQL definitions replaced

- `public.admin_undo` delegates other actions to its previous implementation.
- `public.private_hunt_quest_save` delegates the two compatible editor formats to its previous implementation.
- `private.private_hunt_player_object` builds the shared objects and the compatible payload.
- `public.private_hunt_quest_complete` refuses new rules on the old endpoint.
- `public.game_nearby` adds only the caller's quest releases.
- `public.corrupted_capsule_throw` validates and records a catch against its quest release.
- `private.city_hunt_record_quest` credits the existing Landmark win to eligible quests.
- `public.city_hunt_finish` checks located quests for runs using the new attempt RPC and the legacy counters for older apps.

The shared migration also extends the pool usage helper introduced in checkpoint 1.
