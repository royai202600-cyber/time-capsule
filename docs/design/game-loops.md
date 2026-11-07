# Making it feel like a game: proposal

Status: Roy picked **D. Predict me (預言膠囊)** on 2026-11-07 and settled its three main questions (below). The design and build are still to do. Tasks for Claude and Codex come after Roy's OK on this page.

## The direction
Time Capsule is about emotion and being human in the AI age, not travel. So the "game" should be the emotion itself, and it should be simple. A prediction you make about yourself or a friend fits that: only real time can show whether you were right, and you can't fake a year passing.

**Predict me:** any capsule can carry one prediction ("by next summer you'll have moved to Taipei"). When the capsule opens, the recipient marks it 成真了 / 沒有 (came true / didn't). Predictions that came true go into a small collection.

## How it works (Roy's choices)
1. **An optional line on any capsule.** In Create step 2, next to the hint, there's an optional "prediction" line. There's no new capsule type or new flow. It's sealed with the letter in `capsule_contents`, so nobody can see it before opening.
2. **Two answers: came true / didn't.** After opening, the recipient sees the prediction shown large above the letter, with two buttons. They can change their answer later if life changes. They don't have to answer at all.
3. **The sender sees the prediction again with the verdict.** Once the capsule is opened *and* answered, the sender's Sent card shows their own prediction line and the verdict (for example "Came true ✓"). The rest of the letter stays sealed to the sender, as now.

## The collection
- **Me → 預言紀錄 / Prediction record:** "7 of 12 came true", with the true ones shown as gold-sealed cards (prediction, who it was for, how long it waited).
- Predictions to your future self count too. That's the most personal use.
- Optional later step: the recipient may share a card such as "Predicted 412 days ago. It came true." It never shows the letter.

## What it must not become
- **No AI.** AI never suggests or writes predictions. At most there are a few fixed examples written by us as placeholder text.
- **No scores to compete on.** No leaderboard and no "accuracy %" ranking between friends. The record is only for you and the people involved.
- **No streaks or penalties.** Nothing is lost if you don't predict or don't answer.
- **Sealed means sealed.** Before opening, nobody sees the prediction, the sender included. Afterwards the sender sees only the prediction line and the verdict, never the letter.

## Rough build (for later tasks)
- **Codex (backend):** a `prediction` text field in `capsule_contents`, accepted by `send_capsule()` and returned by `open_capsule()`. `capsules.verdict` (true / false / null) and `verdict_at`, set only by the recipient after opening through a new `set_verdict()`. A way for the sender to read the prediction line once a verdict exists.
- **Claude (screens):** the Create step 2 field, the verdict buttons on the opened letter, the Sent card verdict, and the Me prediction record.
- **Effort:** small to medium. It reuses the existing capsule flow.

## Ideas considered and set aside
Earned landmark vessels (felt too much like a travel app; could still be a quiet bonus later), Cabinet sets, rewards for long waits, the capsule visibly "ripening" while it waits, a shared one-photo-a-day film roll, an exchange diary (交換日記), a shareable opening card, pen-pal seal chains, and capsules that open at the same moment for a group. Ruled out: paying to skip the wait, login streaks, loot boxes, AI-written prompts and travel leaderboards.
