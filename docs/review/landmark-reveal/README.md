# PR #66 landmark celebration review

Reviewed head b7b02b5; green CI 42366748860. Owner-account squash merge d92f13f retains contributor authorship; this owner-authored release record follows.

## Changes

The letter celebrates only a newly earned landmark, with light/ring/vessel/card, Cabinet and letter actions. Review awaits a fresh ownership snapshot before the opening RPC, distinguishes query errors from unowned, scopes delayed callbacks to the route/session and stops pending native animations. Reduce Motion fades without rays/ring/sparkles; English heading tracking is normal. Existing server reward grants are unchanged.

## Validation

`cd mobile && npm run typecheck && npm test` — 29 passing tests, including ownership query failure regressions. `npx expo install --check`, `npx expo export --platform ios`, `npx expo export --platform web` and root `npm run build` pass.

Browser at http://localhost:8088 (390 and 375 px): first Taipei 101 award, Cabinet button leading to the owned close-up, reopening without replay, another capsule at an already-owned place without celebration, and a fresh Senado award under emulated Reduce Motion. Chinese normal and English reduced screenshots are attached. Reduced DOM has zero dashed rings/decorative light or glint images. No UI test route was added.

Roy verified actual iPhone Expo Go on port 8087 using a separate temporary recipient that initially owned no landmarks: normal first-earned celebration, Cabinet button, no replay; then turned on iOS Reduce Motion and confirmed a fresh Taipei award fades without the moving effects. The phone account earned two distinct landmarks.

Three temporary sender/phone/browser fixture users are scoped to this task and removed after production smoke. No permanent test fixture, migration, dependency or settings changes. Run locally with `cd mobile && npm run web` (8088) or `cd mobile && npm start -- --tunnel` (8087).
