# AGENTS.md: 時光膠囊 / Time Capsule

Context for any AI agent working in this folder. Read this before doing anything. Keep it up to date when decisions change. The "Decisions log" at the bottom is the place for new ones.

## Owner and working style
- Owner: **Roy**. He prefers to **keep it simple**: fewest moving parts, no speculative features.
- Propose before building anything big (stack, architecture, new dependencies) and wait for Roy's OK.
- Always make the app **runnable locally** and tell Roy the exact command and URL. Check it in the browser before saying something works.

## Team and roles (from 2026-11-06)
Two AI agents work on this project, and **Roy relays between them**.
- **Claude** (Claude Code): product planning, UI/UX design, front-end screens (`index.html`, `src/styles.css`, `src/art.js`, `src/i18n.js`, and the screen/markup parts of `src/main.js`). Writes each piece of work as a task in `docs/TASKS.md` and a ready-to-paste prompt for Codex. Reviews Codex's reports. Works on `claude/<topic>` branches and opens pull requests; does **not** push to `main`, run migrations, or deploy.
- **Codex**: everything else. Backend (Supabase migrations, row-level security, database functions, auth settings), wiring screens to data, code review, **merging to `main`**, deploying to Vercel, and setup work (email provider, domain, Google publishing, CI). Works on `codex/<topic>` branches.
- **Hand-off loop:** Claude writes a prompt → Roy pastes it into Codex → Codex does the work and ends with a report in the format below → Roy pastes the report back to Claude → Claude reviews and writes the next prompt.
- **Codex report format** (end every task with this): 1) what changed (files, migrations, settings), 2) how it was tested (commands and what was checked in a browser), 3) what is live (deployed URL and version, migrations applied), 4) anything not done, risky, or needing Roy's decision, 5) the merged PR / commit hashes.
- Both agents keep `AGENTS.md` and `docs/TASKS.md` current. Decisions Roy makes go in the Decisions log.

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
- 2026-11-06: Code lives in a **private** GitHub repo, transferred to `royai202600-cyber/time-capsule`.
- 2026-11-06: **Develop against the hosted Supabase project directly** (Roy: "use production to develop"). No local Docker/Supabase stack. The frontend runs locally with `npm run dev` and talks to the hosted project. Schema changes go in `supabase/migrations/` and are applied with `supabase db push`.
- 2026-11-06: Milestone 1 scope kept tight: email-code sign-in, profile with an illustrated portrait (chosen from presets; never initials), friends via invite link, typed letter + hint, the four free vessels, time lock only. Place lock, handwriting, photos, shop, brand capsules and notifications come next. A dev-only "in 2 minutes" open time exists for testing (hidden in production builds).
- 2026-11-06: Hosted Supabase project ref `uzimuygyxwraybsipeij` (Tokyo), linked in this folder. Schema pushed with `supabase db push --remote`; auth settings with `supabase config push` (run `supabase config diff` first; keep production values, not local defaults). Free plan can't use the custom bilingual code email without our own SMTP, so sign-in currently uses Supabase's default **email link** (the app also accepts a code). Add an email provider (e.g. Resend) before real users: it lifts the low built-in email limit and enables `supabase/templates/code.html`.
- 2026-11-06: **Sign-in is "Continue with Google"** (Roy's choice), with the email link kept as a fallback. Google is enabled in the Supabase dashboard (Authentication → Providers), not in `supabase/config.toml`, so `supabase config diff` will show Google as a difference: **never `config push` without first adding the Google block with `env(...)` secrets**, or it will switch Google sign-in off. Apple sign-in is a likely later addition for iPhone users.
- 2026-11-06: **Accounts are email + password** (sign up → verify by email link → sign in; "forgot password" sends a reset link), plus Continue with Google. The password-free email link/code flow was dropped. Supabase's built-in email only delivers to the project's team members and a few per hour, so **other people can't sign up by email until we add our own email service (e.g. Resend)**; Google sign-in isn't affected.
- 2026-11-06: Google sign-in is live. Google Cloud project `timecapsule-513913` ("Google Auth Platform", External, **Testing** mode: only listed test users can use Google sign-in, max 100) with Web client "Time Capsule web" (origin `http://localhost:5173`, redirect `https://uzimuygyxwraybsipeij.supabase.co/auth/v1/callback`). The client secret lives only in the Supabase dashboard. When deploying, add the production URL as a JavaScript origin in Google and to Supabase's redirect URLs, and publish the Google app (needs privacy-policy and home-page links on the Branding page).
- 2026-11-06: **Deployed on Vercel** (Roy's personal team `roy-s-mac-mini`, project `time-capsule`): https://time-capsule-pi-two.vercel.app. Env vars `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set for all environments. Supabase Site URL is the Vercel address; redirect allow-list has localhost and the Vercel address. Deploy with `vercel deploy --prod --scope roy-s-mac-mini`. GitHub → Vercel auto-deploy is not connected (Roy can connect it in the Vercel dashboard).
- 2026-11-06: **Place lock and handwriting added** (milestone 1 had left them out on purpose). Ten fixed places in Asia live in the `places` table (Senado Square fountain, TST Clock Tower, Taipei 101, Sensō-ji, Fushimi Inari, Gyeongbokgung, Merlion, Grand Palace, Forbidden City Meridian Gate, Petronas Towers), each a single checked point with a 100 m radius. The phone's GPS shows the live distance; `open_capsule()` re-checks it on the server (needs a fix with accuracy ≤ 200 m and distance ≤ radius) and records where it was opened. Real map via Leaflet + OpenStreetMap tiles, with the vessel as the pin and a Navigate button (Google Maps). Handwritten (親筆) letters are drawn on a canvas and stored as a PNG data URL in `capsule_contents`, so they stay sealed like typed ones. Dev-only helper: `tcFakeGps(lat, lng)` in the browser console fakes your location (not in production builds). GPS can still be spoofed by a determined user; staff QR check-in for brand capsules is the later answer.
- 2026-11-06: **How to deploy:** Vercel blocks CLI deploys whose git commit author (`roy@roys-Mac-mini.local`) isn't linked to the Vercel account, so deploy a copy without `.git`: `rsync -a --exclude .git --exclude node_modules --exclude dist --exclude '.env*' ./ <tmp>/ && cd <tmp> && vercel deploy --prod --yes --scope roy-s-mac-mini`. A cleaner fix is for Roy to set his git email to the one on his Vercel/GitHub account, or connect the GitHub repo in the Vercel dashboard.
- 2026-11-06: **No phone frame.** The app fills the window on every device; from 700 px wide, each screen's content sits in a centred 640 px column and the card stack shows several fixed-size cards. (The prototype's phone frame was only for demoing.)
- 2026-11-06: **Vessel shop (容器商店) added.** `vessels` table (price in MOP, optional numbered edition, brand) and `owned_vessels`. No payments yet: `acquire_vessel()` gives a vessel free while testing (clearly labelled in the shop) and numbers limited editions in order; `send_capsule()` only accepts free or owned vessels and stamps the edition number (shown on the card, e.g. "Maison Aurèle No.001"). Maison Aurèle stays a fictional demo brand; boutique pickup and gifts come with brand capsules later. Real payments (e.g. Stripe) need Roy's decision.
- 2026-11-06: Roy: **the shop stays free during testing** (prices shown, no payments). Revisit real payments before launch.
- 2026-11-06: **Demo parity pass** (Roy found the app differed from the prototype). Fixed: opening a capsule from the Sent tab now always shows the sender's view (capsules to yourself are in both tabs). Added: photo attachment (shrunk to ≤1280 px JPEG, sealed in `capsule_contents`); a short "why" note per place and a "Memory suggestions — coming soon" card in create step 4; the brand-only place "Maison Aurèle Cotai boutique (demo)" (needs the Maison vessel); edition pill and boutique note on the opening pages; a gift pickup code (`AUR-<edition>-XXXX`, issued by `open_capsule()` when a brand capsule is opened at its boutique) with a real QR on the letter; city on the profile; the two reminder switches on My (saved on the profile, reminders themselves not built yet). The demo's "skip time / simulate arrival" shortcuts stay dev-only on purpose. **Rule going forward: before saying a screen is done, compare it with the prototype's code; anything not built yet gets a visible placeholder rather than being left out.**
- 2026-11-06: Vercel project `time-capsule` is connected to `royai202600-cyber/time-capsule` with `main` as the production branch. Supabase migration `20261106222240_guard_capsule_open` was applied to production: serialize opening, reject invalid GPS values, and restrict invite preview grants to API roles.

- 2026-11-06: Vercel Hobby blocked Git deployments authored by GitHub user `ispkbinary` because that contributor lacks access to the Vercel project. Use the repository owner's GitHub account for release commits, or revisit team access and plan before enabling other authors.
- 2026-11-06: Roy approved Codex's built-in image generation for T9 art assets. OpenAI Docs identifies its built-in model as `gpt-image-2`; an API key is not required. Make three style-sheet variants and wait for Roy's choice before generating the remaining assets.
- 2026-11-06: Roy chose T9 style sheet A (`design/art/style-sheet.png`; variants retained). Use it as the reference for every image. Vessel hatching should be lighter for display around 120 px. Music box and Maison ring box must be closed in their assembled images, with separate lids for opening. Review the dome test vessel and its transparency/stack checks with Roy before creating the other assets.
