# Task board

Owner per task: **Claude** (UI, design, planning) or **Codex** (backend, merging, deploy, setup).
Status: `todo` → `doing` → `review` (report sent to Claude) → `done`. Move a task by editing this file in the same PR as the work.

## Doing
| ID | Task | Owner | Done when |
|---|---|---|---|

## Review
| ID | Task | Owner | Note |
|---|---|---|---|
| T9 | Generate illustration assets with built-in `gpt-image-2`; style sheet A, vessel layers, nine main profile portraits, stamps, map, shelf, wax seal and app icon. Existing SVG/app code untouched. | Codex | Roy approved vessels and first three portraits. All 66 masters, 62 WebP copies, four icon sizes, checks, manifest, README and build are complete. PR awaits Roy's review and merge OK. |
| T9b | Add two paper textures, four scenes, light burst, passport cover/page, cabinet wall and 13-icon reference sheet. | Codex | Included in T9 art PR with transparent/opaque checks and WebP exports; awaiting Roy's PR review. |
| T1 | Onboard: read `AGENTS.md`, run the app locally, review and merge PR "Team workflow", fix the deploy pipeline, review backend security | Codex | Local sign-in and PR #1 verified; security migration applied; Git deployment verification in report. |
| F0 | Expo native app foundation | Codex | SDK 58 Expo Go sign-in and profile save verified by Roy; shared foundation ready for F1–F4. Native Google needs a development build; email verification/reset delivery awaits T2. |
| F4 | Cabinet, Me, Friends, Invite and portrait picker | Codex | Roy confirmed the Expo Go build works; web layout and typecheck pass. T9 portrait manifest integration remains pending. |
| T11 | Backend hardening and bookkeeping | Codex | Distance function search path fixed, function grants reviewed, migration applied and deployment verified. |

## Next (in order)
| ID | Task | Owner | Done when |
|---|---|---|---|
| F1 | Home and capsule opening | Codex | Build the home and opening flows on F0. |
| F2 | Create and seal | Codex | Build the four-step creation and sealing flow. |
| T2 | Email for everyone: buy/choose a domain (Roy), set up Resend SMTP in Supabase, bilingual verify + reset-password templates, raise email rate limit | Codex (+ Roy for the domain and Resend account) | A non-team email address can sign up, verify and reset its password; emails are in 繁中 + English |
| T3 | Publish the Google sign-in app (privacy policy + home page links on the Branding page) and add the production URL as an origin | Codex (+ Roy to approve in Google) | A Google account that isn't a test user can sign in on the live site |
| T4 | Notifications: email "you received a capsule" and "it can be opened now", honouring `profiles.remind_open`; later Web Push | Codex (Claude designs the email look) | Emails arrive at the right moments; switches on My turn them off |
| T5 | Invite by link for people without an account: claim a capsule sent to an email/phone (README §7) | Claude designs → Codex builds | Sending to a non-user produces a shareable link that claims the capsule after sign-up |
| T6 | Installable app (PWA): manifest, icons, offline shell | Claude | "Add to Home Screen" gives a proper icon and full-screen app |
| T7 | Brand capsules for real: staff check-in QR at the boutique, gift escrow/expiry rules, partner console (README §2, §7) | Claude plans → Codex builds | To be specified |
| T8 | Real payments for the shop (only when Roy decides) | Codex | Roy has chosen a provider |

## Done
- F3: Journey, Passport, foreground location and capsule map, with overlapping landmark clusters — Claude approved after the cluster fix; Roy will test the combined app on his phone at the end. F1 integration points are documented in `mobile/src/features/journey/README.md`.
- T1: Onboarding, deployment setup, and backend security review — reviewed and approved by Claude.
- T10: Feel demo built in a separate folder outside the repository.
- Milestone 1 (sign in, friends, send, time lock, hold-to-open), place lock with server GPS check, handwriting, photos, vessel shop (free during testing), brand demo capsule with gift code + QR, responsive layout, Google + email/password sign-in, Vercel deploy. See the Decisions log in `AGENTS.md`.
