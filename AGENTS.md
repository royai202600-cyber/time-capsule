# AGENTS.md: 時光膠囊 / Time Capsule

Context for any AI agent working in this folder. Read this before doing anything. Keep it up to date when decisions change. The "Decisions log" at the bottom is the place for new ones.

## Owner and working style
- Owner: **Roy**. He prefers to **keep it simple**: fewest moving parts, no speculative features.
- Propose before building anything big (stack, architecture, new dependencies) and wait for Roy's OK.
- Always make the app **runnable locally** and tell Roy the exact command and URL. Check it in the browser before saying something works.

## Reference material (read-only)
- Clickable prototype: `/Users/roy/Desktop/Roy_Personal/02_Area/Demo/TimeCapsule_Demo_20261106/`
  - `README.md`: full product concept, capsule states, screens, strategy, and the "what a real version needs" list.
  - `HANDOFF.md`: the original handoff brief.
  - `index.html` / `styles.css` / `art.js` (icons, vessel SVGs, profile-picture SVGs) / `i18n.js` (all zh-Hant + en strings and demo content) / `app.js` (screens and logic).
  - To view it: `cd` there and run `python3 -m http.server 5178`, then open http://localhost:5178. (A local server is needed; the file:// preview doesn't load the scripts.)
- **Never edit the prototype folder.** Copy or port from it into this folder.

## The product
A mobile-first web app for sending someone a sealed **capsule** that can only be opened **at a set time** and, optionally, **at a set place**.

- **Capsule** = content (a typed letter or a **handwritten 親筆** letter drawn with a finger, an optional photo, and a one-line **hint** visible before opening) + a **vessel** (how it looks while sealed) + **unlock rules** (time is required; place is optional, and the recipient must be within 100 m).
- **Vessels:** glass-dome blue rose, message in a bottle, wax-sealed letter, tin; shop items: Mid-Autumn lantern, music box; brand edition: Maison Aurèle ring box (a fictional brand, limited and numbered).
- **States** (inbox): waiting for time (倒數 N 天打開), waiting for place (還差 N 公里), ready (現在可以打開), opened. Sent side: countdown, then waiting to be opened, then opened.
- **Sealed means sealed:** once sent, the sender can't read or edit it either.
- **Opening** is press-and-hold. The time and place of opening are recorded on the capsule.

## Screens (match the prototype)
1. **Home:** profile picture + "My" (top left), a 收件 / 寄件 (Inbox / Sent) switch, a language button and the shop (top right), a swipeable card stack, and a ＋ button. Each card shows the vessel, countdown headline, place, From/To with profile picture, and sealed date.
2. **Opening pages** (numbered, swipeable): (1) arrival story ("時光膠囊在…發出，經過 N 天時間的沉澱…立即出發到 📍place"), (2) map with the vessel as the pin, (3) unlock checklist, sender's hint, hold-to-open. Then the letter (and a gift pickup code for brand capsules).
3. **Create** (4 steps): recipient (friends or 未來的自己), message (type or handwrite, photo, hint), vessel, time and place (with AI "memory" place suggestions). Then the wax-seal "已封存" screen.
4. **Shop:** featured brand collaboration, then all vessels.
5. **Me:** profile, counts, friends, owned vessels, reminder toggles, language.

## Fixed decisions
- **Languages:** Traditional Chinese (default) and English, switchable anywhere and remembered. All UI text goes through translation files, with no hard-coded strings.
- **People are shown with profile pictures, never initials in a circle.**
- **Visual design:** ink blue `#2F5D8A`, plum `#6E2B3F`, brass `#C9A15A`, wax red `#A3364F`, navy `#16263F`, cool paper background `#F6F8FB`. Noto Serif TC for headlines and numbers, Noto Sans TC for body text, LXGW WenKai TC for handwriting. Line-drawn vessel illustrations.
- **Positioning ("precious in the AI age"):** time that really passed and physically being somewhere can't be faked. AI is only a concierge (place suggestions, reminders) and **never writes the letter**.
- **Luxury partners:** a place-locked capsule can open inside a boutique. Numbered limited vessels, and an in-store gift pickup code and QR.
- Location must ultimately be **checked on the server**, not trusted from the client.

## Roadmap
1. Agree the tech stack with Roy.
2. Project setup + git. Port the prototype's look, both languages, and portraits.
3. **Milestone 1:** sign in, send a time-locked capsule to a friend, receive it, and open it with hold-to-open when the time comes. Runs locally.
4. Then: place-locking with server-side check, handwriting, photos, notifications, shop, brand capsules.

## How the code is laid out
- `index.html`, `src/main.js` (screens and logic), `src/styles.css` (ported from the prototype + additions at the bottom), `src/art.js` (icons, vessels, portraits), `src/i18n.js` (all zh/en strings).
- `supabase/migrations/`: database schema. Capsule content lives in `capsule_contents`, which clients can't read; only `open_capsule()` returns it, to the recipient, after `open_at` by the database clock. Writes go through `send_capsule()`, `accept_invite()`, `mark_seen()`.
- `supabase/templates/code.html`: the sign-in code email (bilingual).
- Run: `npm install`, put the project URL and publishable key in `.env.local` (see `.env.example`), then `npm run dev` → http://localhost:5173.

## Decisions log
- 2026-11-06: Project moved from prototype to development. Roy asked to keep it simple and to always be able to run it locally.
- 2026-11-06: **Tech stack agreed (Option A).** Frontend: plain HTML/CSS/JS ported from the prototype, Vite as dev server/bundler only (no framework), installable PWA later. Backend: Supabase (Postgres + row-level security, Auth with email one-time code, Storage for photos, server functions). The time lock is enforced on the server: capsule content is only returned by a database function that checks the open time against server time. Notifications: email first, Web Push later. Hosting: Vercel (Roy's account) + hosted Supabase. 
- 2026-11-06: Code lives in a **private** GitHub repo `coding4human123/time-capsule`.
- 2026-11-06: **Develop against the hosted Supabase project directly** (Roy: "use production to develop"). No local Docker/Supabase stack. The frontend runs locally with `npm run dev` and talks to the hosted project. Schema changes go in `supabase/migrations/` and are applied with `supabase db push`.
- 2026-11-06: Milestone 1 scope kept tight: email-code sign-in, profile with an illustrated portrait (chosen from presets; never initials), friends via invite link, typed letter + hint, the four free vessels, time lock only. Place lock, handwriting, photos, shop, brand capsules and notifications come next. A dev-only "in 2 minutes" open time exists for testing (hidden in production builds).
- 2026-11-06: Hosted Supabase project ref `uzimuygyxwraybsipeij` (Singapore), linked in this folder. Schema pushed with `supabase db push --remote`; auth settings with `supabase config push` (run `supabase config diff` first; keep production values, not local defaults). Free plan can't use the custom bilingual code email without our own SMTP, so sign-in currently uses Supabase's default **email link** (the app also accepts a code). Add an email provider (e.g. Resend) before real users: it lifts the low built-in email limit and enables `supabase/templates/code.html`.
- 2026-11-06: **Sign-in is "Continue with Google"** (Roy's choice), with the email link kept as a fallback. Google is enabled in the Supabase dashboard (Authentication → Providers), not in `supabase/config.toml`, so `supabase config diff` will show Google as a difference: **never `config push` without first adding the Google block with `env(...)` secrets**, or it will switch Google sign-in off. Apple sign-in is a likely later addition for iPhone users.
