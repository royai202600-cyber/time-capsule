# PR #53: keyhole hold seal review

Reviewed source: `a4c248a6e0b4e2201fb220b57fb435f5c7fc513c`.

No blocking findings. `RitualHold` installs `contextmenu` and `selectstart` listeners only on web, on the mounted Pressable DOM node, and removes those same handlers in effect cleanup. The icon has no pointer events; the label is separate and non-selectable. Native receives no DOM listeners or web styles. Its seal design/pressed scale change is intentional; the existing 1.6-second timer, progress/completion callbacks, cancellation and haptics remain unchanged. Reduce Motion skips the pressed scale.

## Checks

From `mobile/`:

- `npm test`: 23 passed.
- `npx tsc --noEmit`: passed.
- `npx expo install --check`: dependencies up to date.
- `npx expo export --platform web --output-dir /tmp/timecapsule-pr53-web`: passed.
- `npx expo export --platform ios --output-dir /tmp/timecapsule-pr53-ios`: passed.

Browser: existing `npm run web` server at http://localhost:8088, Chrome at desktop default width (836 px) and 375 × 812. Created an envelope self-capsule with the dev-only two-minute unlock and the fixture text “PR53 hold-seal browser verification.” Server time elapsed normally; no database time override or location bypass was used.

Mouse partial holds at both widths produced a partial brass arc and no selection; early release removed the progress arc and left the capsule unopened. A continuous emulated touch hold at 375 px filled the ring, entered opening, and returned the actual test letter with an opening timestamp. Computed `user-select: none` and `touch-action: manipulation` were present. Dispatching cancellable `selectstart` and `contextmenu` events on the mounted button returned `defaultPrevented: true`. No browser errors; React Native Web reports its existing native-driver fallback warning. The temporary viewport override was reset. No test route or harness was added.

Evidence: `mobile-idle.png`, `mobile-partial.png`, `mobile-touch-hold.png`, `mobile-opened-letter.png`, `desktop-idle.png`, `desktop-partial.png`.

These desktop Chrome checks do not establish physical Safari/Expo Go behavior. Roy will check both at the end; explicitly not a merge gate.

## Release

Merge only. No deploy today, no settings/dependency changes and no new migrations. The pre-existing batch-1 migration remains UNAPPLIED. Next combined release: deploy the new app → confirm #49 live → apply its held catalogue migration → perform the outstanding catalogue device checks.
