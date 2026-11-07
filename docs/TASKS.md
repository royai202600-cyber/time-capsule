# Task board

Owner per task: **Claude** (UI, design, planning) or **Codex** (backend, merging, deploy, setup).
Status: `todo` → `doing` → `review` (report sent to Claude) → `done`. Move a task by editing this file in the same PR as the work.

## Doing
| ID | Task | Owner | Done when |
|---|---|---|---|
| L1 | Foreground location and named navigation destinations | Codex | Simulated browser callbacks verified at Roy’s request; native tests and iOS export pass. Await release CI and deployment; physical sensor tests remain unverified. |

## Review
| ID | Task | Owner | Note |
|---|---|---|---|
| W1 | Daily wake-up alarm from an opened capsule | Codex / Roy | PR #41 merged as `ed60924` after green CI. Browser editor, wake and snooze previews, 23 tests, TypeScript and iOS/web exports pass. Roy waived the pre-merge phone gate; physical Expo Go alarm delivery, tap-to-wake and real nine-minute snooze remain for his QR check. Installed-build AlarmKit / Android exact alarms remain later work. |
| T1 | Onboard: read `AGENTS.md`, run the app locally, review and merge PR "Team workflow", fix the deploy pipeline, review backend security | Codex | Local sign-in and PR #1 verified; security migration applied; Git deployment verification in report. |
| F0 | Expo native app foundation | Codex | SDK 58 Expo Go sign-in and profile save verified by Roy; shared foundation ready for F1–F4. Native Google needs a development build; email verification/reset delivery awaits T2. |
| F1 | Home and capsule opening | Codex | Claude verified Home → opening ritual → letter and opening record in browser. F3 native location and map, full-width pages, Sent routing and package QR are integrated; typecheck and web/iOS exports pass. |
| F4 | Cabinet, Me, Friends, Invite and portrait picker | Codex | Roy confirmed the Expo Go build works; web layout and typecheck pass. T9 portrait manifest integration remains pending. |
| T11 | Backend hardening and bookkeeping | Codex | Distance function search path fixed, function grants reviewed, migration applied and deployment verified. |

## Next (in order)
| ID | Task | Owner | Done when |
|---|---|---|---|
| T2 | Email for everyone: buy/choose a domain (Roy), set up Resend SMTP in Supabase, bilingual verify + reset-password templates, raise email rate limit | Codex (+ Roy for the domain and Resend account) | A non-team email address can sign up, verify and reset its password; emails are in 繁中 + English |
| T3 | Publish the Google sign-in app (privacy policy + home page links on the Branding page) and add the production URL as an origin | Codex (+ Roy to approve in Google) | A Google account that isn't a test user can sign in on the live site |
| T4 | Notifications: email "you received a capsule" and "it can be opened now", honouring `profiles.remind_open`; later Web Push | Codex (Claude designs the email look) | Emails arrive at the right moments; switches on My turn them off |
| T5 | Invite by link for people without an account: claim a capsule sent to an email/phone (README §7) | Claude designs → Codex builds | Sending to a non-user produces a shareable link that claims the capsule after sign-up |
| T6 | Installable app (PWA): manifest, icons, offline shell | Claude | "Add to Home Screen" gives a proper icon and full-screen app |
| T7 | Brand capsules for real: staff check-in QR at the boutique, gift escrow/expiry rules, partner console (README §2, §7) | Claude plans → Codex builds | To be specified |
| T8 | Real payments for the shop (only when Roy decides) | Codex | Roy has chosen a provider |
| N3 | TODO: in-app account deletion | Codex | A signed-in user can initiate deletion inside the app before App Store release. Current support-email request remains the interim process. |

## End-of-project phone checklist
- Send a capsule to a friend on Roy's phone and confirm it reaches the friend's Inbox.

## Done
- PR #39 / C1: Scrolling Cabinet wired to A3 crown/row/base tiles, virtualized rows and responsive columns. Reviewed and squash-merged as `2d25bf2` after green CI; combined 23 tests, TypeScript and iOS export pass. Browser checks cover 375/390 px, desktop, base scrolling and close-up return. PR #42 baseY compatibility is retained. An owner-authored release follows; physical Expo Go tilt/gestures remain unverified.
- PR #42: Data-driven vessel spec and generic motion engine, with the seven existing vessels preserved in the manifest. Green CI, TypeScript, 19 tests and iOS export pass; squash-merged as `a3b3c24`. Roy will check native idle/open behavior on all seven vessels later through Expo Go.
- A3: Roy approved cabinet tiles review `7b1f646`; crown, repeatable row and base masters plus full-width 1024 px WebPs at quality 85 with exact alpha preservation are complete. All 71 art masters pass the scoped audit; measured geometry, seam review and regenerated contact sheet are recorded. Claude wires the app separately.
- PR #37: Larger, faster vessel idle motion and glints, with the centred-card and Reduce Motion gates preserved. Green CI, 19 tests, TypeScript and iOS export pass. Browser checked at 390 px, including music-box lid rotation and the static fallback; console clean. Squash-merged as `e48fcb1`, followed by an owner-authored production release. Physical phone appearance for this amplitude change remains unverified.
- PR #35 / #36: Continuous iPhone handwriting plus custom Journey, wax-seal + and Cabinet dock icons. Roy verified long strokes, fast scribbles and outside-pad scrolling on both physical iPhone Expo Go and Safari before merge. Each PR CI passed; the combined candidate passes 19 tests, TypeScript and web/iOS exports. Browser checks covered stroke continuity, scrolling and all three dock routes. Squash-merged in order as `e59df7b` and `fd26580`, followed by one owner-authored production release.
- A2 wiring / PR #34: Approved dome highlight and wax/brass sparkle bundled through the art manifest and shown only during idle motion. Reviewed at 390 px on signed-in Home; captured dome, Maison and lantern peaks, verified Reduce Motion removes the layers, and checked a clean browser console. Green CI, 19 tests, TypeScript and iOS export; squash-merged as `edfafaf`, followed by an owner-authored production release. Physical Expo Go glint appearance remains unverified.
- S1 / PR #33: Restored iPhone Safari sound effects using one touch-unlocked Web Audio context and predecoded buffers. Native keeps prepared Expo players. Roy verified repeated tap effects on the Safari preview; CI, 19 tests, TypeScript and web/iOS exports pass. Squash-merged as `e103e82`, followed by an owner-authored production release. No dependencies, migrations or settings changed.
- PR #31: Softer tap/tick/warning WAV files, no application-code changes. Green PR CI on `6dcba1a`; squash-merged as `f2370cc` through the owner account, followed by an owner-authored production release. All three files validated as mono 16-bit PCM at 44.1 kHz.
- M1 / PR #29: Resting vessel motion merged after green CI as `be267a9`; Home and Create selection retain the active-vessel and Reduce Motion controls.
- PR #30: Background music, nine effects and independent Me switches merged after green CI as `139a1a0`. Effects prepare at startup and rewind between plays. Roy confirmed both audio types in iPhone Expo Go SDK 58 and confirmed the swipe/tap delay is fixed. Fifteen unit tests, TypeScript, dependency checks and web/iOS exports pass; browser Home and audio controls checked. One owner-authored release follows the ordered merges; native seal and keyboard fixes retained.
- A2: Roy approved the separate dome-glass idle highlight and refined four-point wax/brass sparkle; masters, WebP exports, manifest, checks and contact sheet are in the art PR. Claude wires the effects into idle motion separately.
- N4: Native seal pan blocks the ScrollView, with consistent animation drivers and reliable cancellation/snap-back. Screen/Auth share keyboard avoidance; native Create actions stay above the keyboard. Roy confirmed keyboard, seal drag, release and flick in iPhone Expo Go; web checks and iOS/web exports pass. Physical screenshots were not captured from this Mac. Release follows green PR CI.
- PR #26: Restore the original four solid sealed lines (92/76/88/56%) with soft blur. Green CI; squash-merged as `7653a9b`, followed by an owner-authored production release.
- PR #24: Sent view sealed placeholder uses blurred word-shaped lines. Rebased PR CI passed; squash-merged as `bdae57d`, followed by an owner-authored release commit for production.
- A1: Illustrated Expo app replaced the Vite production app in PR #16; PR #17 fixed Shop session loading. Roy's production follow-up adds Chinese-only letter spacing, scroll-driven pagination and the animated seal guide, with 390 px comparison captures under `docs/review/production-polish/`. Roy tests on his phone at the end.
- N2: Claude-approved bilingual privacy, terms and support pages moved into the Expo web export with final contact details, app links, and Vercel routes. Account deletion remains N3.
- N1: Pull-request CI checks mobile tests, TypeScript, Expo dependency versions and web export, plus the root web build. Older runs for the same PR are cancelled; iOS export is a local check.
- T9c: Eleven illustrated map pin positions and overlay, checked against Roy's map and online references; Roy approved and PR #12 merged as `b47ab15`.
- F2: Create, seal and Shop — Roy completed a self-send and acquired Maison Aurèle No.002 in Expo Go; Claude verified a handwritten letter with a photo self-send in the browser and approved the drop/contact motion. Final visual tweaks are in PR #8.
- T9 and T9b: 66 illustration masters, WebP exports, manifest, README and checks; Roy approved and PR #11 merged as `16f741e`.
- F3: Journey, Passport, foreground location and capsule map, with overlapping landmark clusters — Claude approved after the cluster fix; Roy will test the combined app on his phone at the end. F1 integration points are documented in `mobile/src/features/journey/README.md`.
- T1: Onboarding, deployment setup, and backend security review — reviewed and approved by Claude.
- T10: Feel demo built in a separate folder outside the repository.
- Milestone 1 (sign in, friends, send, time lock, hold-to-open), place lock with server GPS check, handwriting, photos, vessel shop (free during testing), brand demo capsule with gift code + QR, responsive layout, Google + email/password sign-in, Vercel deploy. See the Decisions log in `AGENTS.md`.
