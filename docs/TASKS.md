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
| T1 | Onboard: read `AGENTS.md`, run the app locally, review and merge PR "Team workflow", fix the deploy pipeline, review backend security | Codex | Local sign-in and PR #1 verified; security migration applied; Git deployment verification in report. |
| F0 | Expo native app foundation | Codex | SDK 58 Expo Go sign-in and profile save verified by Roy; shared foundation ready for F1–F4. Native Google needs a development build; email verification/reset delivery awaits T2. |
| F1 | Home and capsule opening | Codex | Claude verified Home → opening ritual → letter and opening record in browser. F3 native location and map, full-width pages, Sent routing and package QR are integrated; typecheck and web/iOS exports pass. |
| F4 | Cabinet, Me, Friends, Invite and portrait picker | Codex | Roy confirmed the Expo Go build works; web layout and typecheck pass. T9 portrait manifest integration remains pending. |
| M1 | Vessel idle motion: each resting vessel moves gently (3–6 s loops) using its existing layers; Reduce Motion stays static | Claude | Browser-checked at 375 px; PR open for Codex to merge. Expo Go check at the end. |
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
| A2 | Idle glint art: `vessel-dome-glint` and `fx-glint` (gpt-image-2, per STYLE.md), then Claude wires them into the M1 idle loops | Codex art → Claude wiring | Roy approves the review overlay; art PR merged |
| N3 | TODO: in-app account deletion | Codex | A signed-in user can initiate deletion inside the app before App Store release. Current support-email request remains the interim process. |

## End-of-project phone checklist
- Send a capsule to a friend on Roy's phone and confirm it reaches the friend's Inbox.

## Done
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
