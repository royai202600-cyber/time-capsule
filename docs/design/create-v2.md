# Create v2: simpler private and public capsules

Claude, 2026-11-14. The goal is to make creating a capsule easier to understand while keeping it pretty. Clickable demo: [`demos/create-v2.html`](demos/create-v2.html). Open the file directly in a browser and add `#en` to the URL for English. The demo is disposable and its code is not for porting. The app keeps its own components, theme and art.

## Two entry points, one content page
| | Private capsule | Public capsule |
|---|---|---|
| Starts from | Home ＋ | Journey map, 「放下一個膠囊 / Drop a capsule」 |
| Steps | 收件人 To → 內容 Message → 容器 Vessel → 時間與地點 When & where | 內容 Message → 時間與地點 When & where |
| Recipient | Dropdown, default 未來的我 / Future me | None: anyone passing by can pick it up |
| Content | Block page (below) | The same block page |
| Vessel | Chosen, with search and categories | Always the bottle, not shown as a step |
| Time | Time dropdown (below) | The same time dropdown |
| Place | Place dropdown (below) | Fixed: "Right here", snapped to the nearest public shore |
| Final button | 寄出 / Send → 已封存 | 寄出 / Send → 膠囊放下了 |

Public Sea is no longer a recipient in the private flow. The map's Drop button is the only way to make a public capsule.

## Shared header
- **Top row:** Back (✕ on the first step) · the title 寄一個新膠囊 / Send a new capsule (public: 放下一個公開膠囊) · Next. On the last step Next becomes **寄出 / Send** in both flows. There's no bottom button bar and no divider line under the header.
- **Below it:** `WaxSteps` across the full width with 13 px labels. It shows 4 drops for private and 2 for public.
- Errors appear under the steps, next to the button that caused them.
- **There's no language button inside Create.** The language is set elsewhere in the app.

## Step 1 (private): To
- One dropdown (a bottom sheet on tap) instead of the card grid. Groups: 自己 (未來的我, the default) / 朋友 (each friend with their portrait) / 邀請朋友 (opens `/invite`, as now).
- Under it: a 私人 / Private pill plus one line, "封存後連你也看不到內容…". Then a small letter-paper preview showing "To … / From you" with the wax seal.
- The letter-or-prediction choice (`KindChoice`) is removed. A prediction is now a block (step 2).

## Step 2: Message (block page)
- A sheet of letter paper (`paper-letter` texture) with blocks inside, Notion-style but in our style. It opens with one empty text block.
- A **5-button toolbar** at the bottom of the paper, sticky while scrolling: 文字 Text · 錄音 Voice · 相片 Photo · 手寫 Draw · 預言 Predict. Each tap appends a block and focuses it.
- Each block has a small label plus ↑ ↓ ✕ controls (shown on focus or hover).
- **Prediction block:** one line (1–140 characters, same rule as today) in a brass-outlined box, with the note "打開那天，收件人會判斷你說對了沒有". Only one per capsule: the button greys out once one exists. If there's a prediction and no vessel is chosen yet, preselect the fortune cookie as today. The capsule shows the prediction the way it does now.
- **提示 / Hint** (40 characters) sits under the paper with no helper line. Placeholders are light grey.
- Valid when at least one block has content.

## Step 3 (private): Vessel
- No subtitle. A search field (matching zh/en names and the id) plus horizontally scrolling category chips with counts: 全部 / 經典 / 節慶 / 回憶 / 美食 / 地標 / 品牌聯名. This is ready for about 100 vessels.
- A 3-column grid. Unearned landmark vessels are dimmed with "在地標贏取". Brand vessels show their edition number. Selecting one shows a tick.
- A fortune-cookie suggestion row appears when there's a prediction block.

## Step 4: When & where
- **When:** one dropdown with 明天 / 1 個月後 / 半年後 / 1 年後 / 5 年後 / 自訂日期…. The custom option shows an inline month calendar where past days and today are disabled. A line underneath reads "2027年11月14日 可以打開". Private defaults to 1 year and public to tomorrow. Both flows use the same list.
- **Where (private):** one dropdown with three options:
  - 不限地點 Anywhere (the default)
  - 我現在的位置 Where I am now (the device's GPS point)
  - 指定地點 A specific place: one search box that lists matching landmarks first, then OpenStreetMap results

  The chosen place shows as a card with "收件人要在 100 公尺內才能打開".
- **Where (public):** a fixed card, "就放在這裡 / Right here", explaining that the capsule goes to a nearby public spot and your exact location is never shown. It sits on a small map of the snapped shore. There's no picker.
- A summary card shows the vessel art, To (with the Private/Public pill), what's inside (for example 文字 · 相片 ×2 · 預言), Vessel, When and Where.

## Decisions taken (2026-11-14)
1. Text and handwriting can be used together (Roy, 2026-11-14). Content is a free list of blocks, in any order, with sensible caps: up to 10 blocks per capsule, 1 prediction, and each text block up to 500 characters. Photo, voice and drawing blocks use today's per-item limits.
2. **Public capsules allow all block types.** This reverses the 2026-11-08 rule that sea bottles are typed text only. The existing report flow (hidden for the reporter immediately, hidden for everyone after 2 reports) still applies. **Roy needs to confirm whether media in public capsules needs extra moderation before release.**
3. A private capsule can lock to any map point, not only the `places` list. The 100 m check stays on the server.
4. Vessel categories are a client-side mapping (names already live in the client), so no migration is needed for them.

## Backend contract (Codex)
- **Ordered blocks.** Store a capsule's content as ordered blocks, for example `capsule_blocks(capsule_id, position, kind in ('text','drawing','photo','voice','prediction'), text, object_path, duration_ms)`. Clients still can't read it. `open_capsule()` returns the blocks in order, only to the recipient, only after `open_at` and only at the place when there is one. Existing capsules must keep opening, either by migrating their message/drawing/photo/voice/prediction into blocks or by having `open_capsule` build blocks from the old columns.
- **Send.** `send_capsule` takes the blocks (a JSON array) instead of the separate message/drawing/photo/voice/prediction arguments. It validates the caps above and keeps the current checks (vessel owned, brand place, friend, open time in the future). The prediction "was I right" flow keeps working from the prediction block.
- **Any place.** A private capsule takes either `p_place` (a landmark id) or `p_lat`/`p_lng` with a display name. The server stores the point and checks 100 m on opening, like landmarks.
- **Place search.** Use OpenStreetMap data (for example Nominatim or Photon). Check its usage policy and rate limits, ideally put it behind our own Edge Function, and record the choice.
- **Public.** Sea bottles accept the same blocks and always use the `bottle` vessel. `throwBottle` takes `open_at` from the shared time list instead of drift days (1/7/30/365). The snapping to a nearby shore and the 100 m pickup stay as they are.
- Hiding sealed content, server-side time checks and the RLS rules in `AGENTS.md` all still apply.

## Status (2026-11-14)
Phase 1 is built in PR #109: everything above runs on today's backend. Remaining limits: one block of each kind, public capsules are text only, and a GPS point or searched address can be chosen but `ANY_PLACE_BACKEND` (`mobile/src/services/places.ts`) stays false until the backend takes points. Until then Send refuses those with a clear message.

## Suggested order
1. **Front-end on today's backend:** the header and compact `WaxSteps`, the To dropdown, the block page with today's limits (greying out a button when its single slot is used), vessel search and categories, the time dropdown and calendar, the place dropdown with Anywhere and Landmarks, the public flow from the map with text plus the existing drift mapped to the time list, and no language button.
2. **Backend:** ordered blocks, any map point plus current location, place search, and media in public capsules once Roy confirms moderation.
3. Then remove the temporary limits from step 1.
