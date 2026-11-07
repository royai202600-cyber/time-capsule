# PR #55 review

Reviewed app head: `be8effa5e557eeb2648a12ddfc3c88d74a7c9053`.

No blocking findings. No application code changes were needed during review.

- WaxSteps only enables completed drops. Its handler matches Back: dismiss keyboard, set previous step, clear error, tap feedback. It does not change mode or clear the message/drawing. The DrawingPad stays mounted with its existing display gate.
- SealLoader uses a native-driver rotation on an Animated.View that overlays the SVG; it does not animate SVG props with the native driver. Its loop stops during cleanup; Reduce Motion resets the arc to its static position.
- Countdown uses native-driver scaleY on Animated.Text. Its existing one-second interval cleans up, and its accessibility timer label is retained. Reduce Motion swaps values without starting flips.

## Fresh-worktree checks

Worktree: `/Users/coding4human/.codex/worktrees/review-art-ui-55/TimeCapsule_Development`.

From `mobile/`: `npm ci`, `npm run typecheck`, `npm test` (23 passed), `npx expo install --check`, `npx expo export --platform ios --output-dir /tmp/timecapsule-pr55-ios`, `npx expo export --platform web --output-dir /tmp/timecapsule-pr55-web` all passed. No dependency files changed. npm reports five existing moderate audit findings; no unrelated upgrades or force audit fix were applied.

## Browser

`cd mobile && npm run web`, http://localhost:8088, Chrome at 375 × 812.

- Create 1 → 2 → 3 with a typed draft, drop 2 → drop 1: draft retained, current/future drops disabled, validation error cleared.
- Handwrite a stroke, Next → drop 2: ink retained and Next works again. Repeat with footer Back: exact SVG stroke path matches. Both language step labels fit.
- Open an existing time-locked dome capsule: timer label ticks each second. Samples captured the seconds transform folding and returning to identity; the other cards stayed still between changes.
- Emulated Reduce Motion: timer still ticks; all four sampled transforms stayed at identity.
- Delay data requests while returning Home: seal loader is visible. Under Reduce Motion its arc transform remains identical; after disabling Reduce Motion its matrices change as it rotates.
- No console errors. Existing React Native Web native-driver fallback warning only. Temporary network, reduced-motion and viewport overrides restored. A throttled full reload initially stayed blank while startup assets loaded; after normal network was restored the real page loaded and the loader was checked by delaying only subsequent data requests.
- No capsule was sent or modified for these checks. Typed/handwritten test drafts were discarded. No test route or browser harness was added.

Screenshots: `wax-step-3.png`, `handwriting-return.png`, `countdown.png`, `seal-loader.png`.

## Release

Merge only, queued for next combined release. No new migration, dependency or settings changes. Do not apply held catalogue migration `20261107073919_add_batch1_vessels`; preserve deploy → confirm #49 live → explicitly authorized db push. Physical iPhone Expo Go checks of the three components remain for Roy’s end-of-run test.
