# A1 visual review

These are 390 px wide browser captures from the Expo web app at `http://localhost:8083` on 2026-11-07. The app was connected to the hosted Supabase project for the end-to-end capsule test. The sealed result uses `scene-sealed.webp`; the seal ceremony uses `seal-wax.webp`.

## Original web design comparison

The **Original** column uses `src/main.js` and `src/styles.css` from the root web app. The signed-in browser returned to the configured production origin after Google OAuth; that deployment serves the same root app. The place-waiting state uses [this reproducible root-CSS fixture](original-place-reference.html), because no suitable unopened, time-unlocked record was available in that account. Its 1.2 km value is illustrative. The **Expo** column is the PR #16 local web app, using the new illustrated art. All mobile captures below are exactly 390 × 844 px; desktop captures are 1440 × 900 px.

| 390 px screen | Original | Expo PR #16 |
| --- | --- | --- |
| Sign-in | ![Original sign-in](original-signin-390.jpg) | ![Expo sign-in](expo-signin-390.jpg) |
| Home, waiting for time | ![Original time card](original-home-time-390.jpg) | ![Expo time card](expo-home-time-390.jpg) |
| Home, waiting for place | ![Original place card](original-home-place-390.jpg) | ![Expo place card](expo-home-place-390.jpg) |
| Capsule page 1 | ![Original page one](original-page1-390.jpg) | ![Expo page one](expo-page1-390.jpg) |
| Sent, waiting | ![Original waiting sender](original-sender-390.jpg) | ![Expo waiting sender](expo-sender-waiting-390.jpg) |
| Sent, opened | ![Original opened sender](original-sender-opened-390.jpg) | ![Expo opened sender](expo-sender-opened-390.jpg) |

| Desktop screen | Original | Expo PR #16 |
| --- | --- | --- |
| Sign-in | ![Original desktop sign-in](original-signin-desktop.jpg) | ![Expo desktop sign-in](expo-signin-desktop.jpg) |
| Home, waiting for time | ![Original desktop time card](original-home-time-desktop.jpg) | ![Expo desktop time card](expo-home-time-desktop.jpg) |
| Home, waiting for place | ![Original desktop place card](original-home-place-desktop.jpg) | ![Expo desktop place card](expo-home-place-desktop.jpg) |
| Capsule page 1 | ![Original desktop page one](original-page1-desktop.jpg) | ![Expo desktop page one](expo-page1-desktop.jpg) |
| Sent, waiting | ![Original desktop waiting sender](original-sender-desktop.jpg) | ![Expo desktop waiting sender](expo-sender-waiting-desktop.jpg) |
| Sent, opened | ![Original desktop opened sender](original-sender-opened-desktop.jpg) | ![Expo desktop opened sender](expo-sender-opened-desktop.jpg) |

The sign-in top illustration now uses the **welcome scene**, the app's WebP export of `design/art/scenes/scene-welcome.png`, as Roy requested. The 390 px and desktop Expo sign-in captures above show this update. Empty inbox uses `scene-empty-inbox.webp`, empty sent uses `scene-empty-sent.webp`, and the sealed result uses `scene-sealed.webp`; all three were checked against their screen code and browser captures. The Home card number, page story emphasis, four live countdown boxes, destination link, sender's dashed sealed placeholder, and plain centered hint use the original CSS measurements and colors. The countdown remains visible until a sent capsule is actually opened, including at zero after its unlock time.

## Vessel motion review

![All seven vessels at lidLift 0, 0.5, and 1; envelope and lantern seal stages](vessel-motion-frames.jpg)

Each row uses the actual illustrated `Vessel` layers at `lidLift` 0, 0.5, and 1. The final two rows show the seal ceremony's envelope and lantern open, letter entry, and closed states. This frame study was captured in a temporary Expo review route, which was removed from the branch. A separate in-browser geometry check confirmed that the letter's **outer translation** carries the shrunken paper to the vessel body; the earlier single-view transform left it above the opening. The envelope seal fades before its flap flips on the y=260 fold; the lantern cap travels about 9% of the image; the hinged lids tip back by 22° with 0.7 vertical scale; the bottle cork falls away and the letter exits diagonally. The Maison ring enlarges slightly and glints on reveal. The opening burst now blooms for 700 ms, with a simple fade under Reduce Motion.

The live envelope opening was also captured [at release](envelope-opening-0.jpg), [during bloom](envelope-opening-220.jpg), and [as the bloom settles](envelope-opening-650.jpg). The letter appeared after the hold and the server recorded the opening.

## PR #16 Cabinet re-review

| Check | New 390 px capture |
| --- | --- |
| Shelf alignment, unowned silhouettes, plaques | [Cabinet idle](cabinet-idle-v2.jpg) |
| Pointer hover lift and parallax | [Cabinet hover](cabinet-hover-v2.jpg) |
| Fly-out and details card | [Vessel lifted](cabinet-lifted-v2.jpg) |
| Map fills frame | [Journey cover](journey-cover-v2.jpg) |
| Paper texture reaches every sheet edge | [Opened typed letter](letter-typed-v2.jpg) |
| Transparent ink and photo on paper | [Opened handwritten letter with photo](letter-handwritten-photo-v2.jpg) |

Cabinet positions use the measured shelf surfaces at y=250/510/765 and usable width x=175–850 on its 1024 px canvas. The assembled vessel alpha bounds determine each image's top so its painted base touches the board. The web hover and return animations were checked in-browser. Journey's display change only scales and pans the same stylised artwork; its geography and pin coordinates were not changed. Before the map framing edit, the artwork and [online East/Southeast Asia reference](https://maplab-icon.com/blog-entry-784-html/) were inspected alongside [Natural Earth coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/).

The handwritten-photo check used a temporary public sample landscape photo from [Lorem Picsum](https://picsum.photos/seed/timecapsule-a1-flower/800/600). The sample is not committed to the repository. The web photo picker was adjusted because Expo SDK 58 generated a malformed `accept` filter in Chrome on macOS. Native photo picking was not changed.

| Flow | Captures |
| --- | --- |
| Entry and profile | [Welcome](welcome.jpg), [profile picker](profile-picker.jpg) |
| Home | [Empty inbox](empty-inbox.jpg), [empty sent](empty-sent.jpg), [card](home-card.jpg) |
| Capsule | [Story](capsule-1.jpg), [map/story page](capsule-2.jpg), [ready to open](capsule-ready.jpg), [updated typed letter](letter-typed-v2.jpg), [handwritten letter with photo](letter-handwritten-photo-v2.jpg) |
| Place capsule | [Story](capsule-place-1.jpg), [map](capsule-place-2-map.jpg), [checklist](capsule-place-3.jpg) |
| Create | [Step 1](create-1.jpg), [step 2](create-2.jpg), [step 3](create-3.jpg), [step 4](create-4.jpg), [seal ceremony](seal-ceremony.jpg), [sealed result](sealed.jpg) |
| Other screens | [Shop](shop.jpg), [updated cabinet](cabinet-idle-v2.jpg), [cabinet hover](cabinet-hover-v2.jpg), [lifted vessel](cabinet-lifted-v2.jpg), [updated Journey](journey-cover-v2.jpg), [Passport](passport.jpg), [Me](me.jpg), [Me in Traditional Chinese](me-zh.jpg) |

The Invite screen was checked in the browser. Its normal link, Copy, and Share controls worked, and the app link appeared only in the share text. Its capture is omitted because the field contained a live invite token. The envelope and lantern ceremony stages are included in the vessel motion strip above. The live letter drop was also checked in-browser after separating translation from scale.

The stylised Journey map and its pin overlay were checked against `design/art/_checks/map-pins.png`. The real-world reference used for the art was [Natural Earth 10m coastlines](https://www.naturalearthdata.com/downloads/10m-physical-vectors/), as recorded in `design/art/README.md`. Pin positions remain approximate display coordinates, and Senado/Cotai clustering remains enabled.

## Verification

- `tsc --noEmit`: passed.
- `expo export --platform web`: passed.
- `expo export --platform ios`: passed.
- Browser: Google sign-in, portrait setup, both Home tabs, Create steps, sealing, hold-to-open, typed and handwritten letters, Shop, Cabinet (idle/hover/fly-out/return), Journey (cover and pan), Passport, Me, Invite, and the three place capsule pages were checked. Five self-test capsules were sent to the hosted database across this A1 review; four were opened after their two-minute test locks. A development-only simulated fix 1.2 km from Senado was used solely for the place-waiting screenshot.
- Expo Go phone verification remains for Roy's review gate. No migrations or auth setting changes were made.
- `npm audit`: five moderate findings in Expo/CLI transitive packages. The offered automatic fix downgrades Expo to SDK 53, so dependencies were left on SDK 58.

Local Expo run: `cd mobile && npm install && npm run web -- --port 8083`; open `http://localhost:8083`. Supply `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `mobile/.env.local` as described in `mobile/README.md`. Original web run: from the repository root, `npm install && npm run dev`; open `http://localhost:5173` with the root `.env.local` configured from `.env.example`.
