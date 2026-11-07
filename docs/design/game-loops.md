# Making it feel like a game: Predict me (預言膠囊)

Status: Roy chose this direction on 2026-11-07. The screens are built in `claude/predict-me` behind `PREDICTION_BACKEND = false`; Codex wires the backend (task P1 in `docs/TASKS.md`).

## The direction
Time Capsule is about emotion and being human in the AI age, not travel. So the "game" should be the emotion itself, and it should be simple. A prediction you make about yourself or a friend fits: only real time can show whether you were right, and you can't fake a year passing.

## How it works
**A prediction is a special kind of capsule.** It goes through the same Create flow, with no separate feature or extra screens.

1. **Create step 1:** "What are you sending?" offers two choices, 一封信 / A letter or 一個預言 / A prediction, above the recipient choice. You can also start straight into a prediction by opening `/create?kind=prediction`.
2. **Create step 2:** for a prediction, the prediction line comes first: up to 140 characters, in the handwriting font, on a fortune-slip card. A letter, photo or voice note can go underneath and is optional.
3. **Create step 3:** the vessel is chosen as normal. The fortune cookie is selected for you if you have it, but any vessel works.
4. **Create step 4 and sealing:** the same as now. The sealed screen says the prediction will reach them on that date.
5. **Before opening:** both sides see a small 預言 tag on the Home card. Nobody sees the text, the sender included.
6. **Opening:** the recipient sees the prediction above the letter, with **one wax stamp**. Tap it and a seal marked 成真 / TRUE stamps down. Tap again to remove it. Leaving it unstamped means it didn't come true or they haven't decided. They can change it at any time.
7. **The sender's view:** once the capsule is opened, the sender's capsule page shows their prediction line and whether it was stamped. The letter stays sealed to the sender.
8. **Me → Prediction record (預言紀錄):** every opened prediction you wrote or received, for example "3 / 5 成真". The stamped ones get a full-colour wax seal.

## What it must not become
- **No AI.** AI never suggests or writes predictions. The placeholder example is fixed text that we wrote.
- **No scores to compete on.** No leaderboard and no accuracy ranking. The record is only for you and the people involved.
- **No streaks or penalties.** Nothing is lost if you never predict or never stamp.
- **Sealed means sealed.** Before opening, nobody sees the prediction. Afterwards the sender sees only the prediction line and the stamp, never the letter.

## Backend contract (for Codex)
The client is in `mobile/src/services/prediction.ts`.
- `capsules.kind` text, `'letter'` (default) or `'prediction'`, readable like `hint`. It is set by `send_capsule`.
- `send_capsule(..., p_kind text default 'letter', p_prediction text default null)`: for `'prediction'`, `p_prediction` is required (trimmed, 1–140 characters) and `p_message` may be empty. It is stored in `capsule_contents.prediction`, sealed like the letter. A prediction is rejected for kind `'letter'`.
- `open_capsule()` also returns `prediction` and `verdict` to the recipient.
- `capsules.verdict boolean null` and `verdict_at timestamptz`. `set_prediction_verdict(p_id, p_verdict boolean)`: only the recipient, only after opening, only for kind `'prediction'`. `null` clears it. It can be changed later. The UI currently sends only `true` and `null`, but the backend accepts `false` too.
- `prediction_for_sender(p_id)`: only the sender, only once `opened_at` is set. Returns `prediction, verdict, verdict_at`.
- `prediction_record()`: the caller's opened predictions, sent or received. Returns `capsule_id, role ('sent'|'received'), other (uuid of the other person, or null for a capsule to yourself), prediction, verdict, sealed_at, opened_at`.
- Then set `PREDICTION_BACKEND = true`. Until then, the Predict me choice only appears in development, and runs on an in-memory stub.

## Ideas considered and set aside
Earned landmark vessels (felt too much like a travel app; could be a quiet bonus later), Cabinet sets, rewards for long waits, the capsule visibly "ripening", a shared one-photo-a-day film roll, an exchange diary, a shareable opening card, pen-pal seal chains and group capsules that open at the same moment. Ruled out: paying to skip the wait, login streaks, loot boxes, AI-written prompts and travel leaderboards.
