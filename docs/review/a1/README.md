# A1 visual review

These are 390 px wide browser captures from the Expo web app at `http://localhost:8083` on 2026-11-07. The app was connected to the hosted Supabase project for the end-to-end capsule test. The sealed result uses `scene-sealed.webp`; the seal ceremony uses `seal-wax.webp`.

| Flow | Captures |
| --- | --- |
| Entry and profile | [Welcome](welcome.jpg), [profile picker](profile-picker.jpg) |
| Home | [Empty inbox](empty-inbox.jpg), [empty sent](empty-sent.jpg), [card](home-card.jpg) |
| Capsule | [Story](capsule-1.jpg), [map/story page](capsule-2.jpg), [ready to open](capsule-ready.jpg), [letter](letter.jpg) |
| Place capsule | [Story](capsule-place-1.jpg), [map](capsule-place-2-map.jpg), [checklist](capsule-place-3.jpg) |
| Create | [Step 1](create-1.jpg), [step 2](create-2.jpg), [step 3](create-3.jpg), [step 4](create-4.jpg), [seal ceremony](seal-ceremony.jpg), [sealed result](sealed.jpg) |
| Other screens | [Shop](shop.jpg), [cabinet](cabinet.jpg), [lifted vessel](cabinet-lifted.jpg), [Journey](journey.jpg), [Passport](passport.jpg), [Me](me.jpg), [Me in Traditional Chinese](me-zh.jpg) |

The Invite screen was checked in the browser. Its normal link, Copy, and Share controls worked, and the app link appeared only in the share text. Its capture is omitted because the field contained a live invite token. A capture during the short seal transition showed only the “Sealing…” frame, so it is omitted; the ceremony and result are shown above.

The stylised Journey map and its pin overlay were checked against `design/art/_checks/map-pins.png`. The real-world reference used for the art was [Natural Earth 10m coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/), as recorded in `design/art/README.md`. Pin positions remain approximate display coordinates, and Senado/Cotai clustering remains enabled.

## Verification

- `tsc --noEmit`: passed.
- `expo export --platform web`: passed.
- `expo export --platform ios`: passed.
- Browser: Google sign-in, portrait setup, both Home tabs, Create steps, sealing, hold-to-open, opened letter, Shop, Cabinet, Journey, Passport, Me, Invite, and the three place capsule pages were checked. Two self-test capsules were sent to the hosted database; one was opened after its two-minute test lock.
- Expo Go phone verification remains for Roy's review gate. No migrations or auth setting changes were made.
- `npm audit`: five moderate findings in Expo/CLI transitive packages. The offered automatic fix downgrades Expo to SDK 53, so dependencies were left on SDK 58.

Local run: `cd mobile && npm install && npm run web -- --port 8083`; open `http://localhost:8083`. Supply `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `mobile/.env.local` as described in `mobile/README.md`.
