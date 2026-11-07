# Art in the UI: concept

Status: Roy picked all six ideas below on 2026-11-07. Built so far (PR #55): 3 flip countdown (`mobile/src/components/Countdown.tsx`), 4 seal loader (`SealLoader.tsx`) and 5 wax-drop steps (`WaxSteps.tsx`). Ideas 1, 2 and 6 are still to build.

## The idea
The vessels, portraits, scenes and stamps are illustrated, but a lot of the UI around them is still generic: a system spinner, a red progress bar, bordered number boxes, plain date text. The keyhole wax seal on hold-to-open (PR #53) showed the fix: draw the control itself as one of the app's objects (wax, brass, ink, paper), in code. These six ideas apply the same move to the places people see most.

## Rules for all of them
- **Drawn in code** with `react-native-svg`, in the style of `mobile/src/components/DockIcons.tsx` and `design/art/icon-reference.png`: plum or navy ink lines, flat fills plus one shading tone, solid fills only (no gradient ids; they rendered white before).
- **Palette only:** ink blue `#2F5D8A`, plum `#6E2B3F`, brass `#C9A15A`, wax red `#A3364F`, navy `#16263F`, paper `#F6F8FB`, cream `#F3E2BB` / `#FBF1E1`.
- **Reuse one wax shape.** Every seal uses the existing `SEAL` path from `DockIcons.tsx`, so the plus button, hold-to-open, verdict seals and loader look like one family.
- **Text stays text.** Numbers, dates and labels are real `<Text>` (or SVG text) from the zh/en translation files, never baked into a drawing, and keep accessibility labels.
- **Reduce Motion:** every animation has a still version.
- **No new images** for these six. One small component file per idea in `mobile/src/components/`.

## The six (ranked by how much they add)

### 1. Verdict seals (Predict me)
The verdict moment is the new game's peak, so it should feel like an act, not a form.
- The prediction sits on a strip of cream paper with torn edges, in handwriting (LXGW WenKai TC), above the letter.
- Two seals to press: **brass with an embossed ✓** for 成真了 / Came true, **ink blue with an embossed wave** for 沒有 / Didn't. Press-and-hold is not needed; a tap with a short "stamp down" (scale 1.08 → 1.0, haptic success) is enough.
- After answering, the chosen seal sits stamped on the strip's corner. The same small seal shows on the sender's Sent card, and the brass ✓ seal is the "gold seal" on the came-true cards in Me → 預言紀錄.
- Follows `docs/design/game-loops.md` (PR #54): answering is optional, and tapping the stamped seal lets the recipient change the answer later. The sender sees only the prediction line and the seal, never the letter.
- Effort: **small** (the seal shape exists). Depends on the Predict-me backend.

### 2. Postmarks
Time and place are what the app is about; a postmark is the real-world sign that both happened.
- A round double-ring ink postmark in plum with wavy cancel lines: the place name runs around the ring, the date sits in the centre.
- On Home cards it replaces the sealed date in the footer ("封存 · <place>" / date). On the opened letter it records when and where it was opened ("打開 · <place>").
- No place set: the ring shows 不限地點 / Anywhere.
- Effort: **small–medium** (text on a circular path needs checking on iOS, Android and web; fall back to a straight line under the date if it doesn't render).

### 3. Flip countdown
The countdown is the one thing a waiting capsule shows; it should feel like a clock, not a form field.
- Four navy cards in brass frames with a split line and two brass pins, cream serif numbers, plum unit labels underneath.
- The seconds card does a short flip when it changes; Reduce Motion just swaps the number.
- Effort: **small**.

### 4. Seal loader
- A small `SealHoldIcon` (the hold-to-open keyhole seal from PR #53, reused as is) with a short brass arc circling its groove instead of filling it, replacing `ActivityIndicator` on Home, the capsule page, Shop and the letter's voice note. Optional caption, for example 正在取出膠囊… / Fetching your capsule….
- Reduce Motion: the arc stays still and pulses opacity instead.
- Effort: **small**.

### 5. Wax-drop steps (Create)
- Create's four steps become four wax drops on a curved brass ribbon: done = wax red with ✓, current = wax red with a brass ring and its number, future = dashed outline. Step names underneath (收件人, 內容, 容器, 時間地點).
- Tapping a done drop goes back to that step (the current back behaviour, just reachable).
- Ties into the seal ceremony at the end: the fourth drop becomes the seal.
- Effort: **small**.

### 6. Flourish headers
- Section headings (Shop 全部容器, Me sections, Cabinet title, Friends) get a thin plum ink flourish on each side with a small brass diamond.
- The same flourish, without a heading, closes the opened letter before the signature.
- Use sparingly: one per section, never on every label.
- Effort: **small**.

## Order to build
One screens PR can carry 3–6 together (small changes on many screens): loader, wax-drop steps, flourish headers, flip countdown, postmarks. Verdict seals (1) ship with the Predict-me screens task, after Codex's backend for it.

## Not picked or left for later
- Me counts as small paper tags, brass toggle switches, and hanging brass price tags in the Shop. Possible later; not mocked up.
- Paper texture behind every screen. The letter already has `paper-letter.webp`; using it everywhere would make the screens busy.

## Codex request (only where code can't do it)
None of the six needs generated art. Two empty states are still plain text and would want a scene in the style of `scene-empty-inbox.png` (gpt-image-2, `design/art/STYLE.md` rules, about 1536×1024, edges fading to transparent):
- **Empty Friends:** two empty chairs at a small table with two teacups, an invitation card with a wax seal between them.
- **Empty prediction record (Me → 預言紀錄):** a closed brass-cornered notebook with a ribbon marker and an unlit candle.

These aren't requested yet. Roy decides when they go to Codex.
