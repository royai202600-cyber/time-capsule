# 時光膠囊 / Time Capsule: app design spec (Expo app in `mobile/`)

Owner: Claude (design). Builders: Codex sessions F1–F4. Art: the artwork session (see "Art needs").
This is the single reference for how every screen looks, moves and feels. When a screen is built, compare it with this spec **and** with the prototype's behaviour (web app in `src/`); anything not built yet gets a visible placeholder, never silently left out.

---

## 0. Principles

1. **Precious, not addictive.** The game feel celebrates time that really passed and places you really went. No loot boxes, no streak guilt, no red badges begging for attention. Rewards are quiet and earned: a stamp, a glow, a number.
2. **Physical.** Everything you touch follows your finger, has weight, and settles with a spring. Animations can be interrupted at any point and continue from where they are.
3. **One ritual per moment.** Sealing and opening are the two ceremonies; they get the richest motion and haptics. Everything else is calm and quick.
4. **Both languages everywhere.** 繁體中文 is the default; English is one tap away and remembered. No hard-coded text; every string has a key in the strings file.
5. **People are portraits, never initials.**
6. **Reduce Motion** replaces movement with short fades and keeps haptics light.

### Motion vocabulary (use these presets from the theme, don't invent new ones)
| Name | Use | Feel |
|---|---|---|
| `spring.soft` | cards settling, sheets | damping 18, stiffness 160 |
| `spring.snappy` | buttons, chips, toggles | damping 22, stiffness 320 |
| `spring.heavy` | lids, seal stamp, stamp slam | damping 14, stiffness 120, mass 1.4 |
| `fade.quick` | text swaps, toasts | 160 ms ease-out |
| `breathe` | idle life on sealed vessels | 3.2 s loop, scale 1 → 1.015, y 0 → −2 |

### Haptics vocabulary
| Name | Expo call | Use |
|---|---|---|
| tick | `selectionAsync` | carousel snap, chip select, page change |
| tap | `impactAsync(Light)` | buttons |
| thump | `impactAsync(Heavy)` | seal stamped, lid released, passport stamp |
| build | Light → Medium → Heavy, every 180 ms → 90 ms | press-and-hold charging |
| success | `notificationAsync(Success)` | capsule sent, vessel acquired |
| warn | `notificationAsync(Warning)` | not yet / too far |

### Visual system
- Colours, fonts, spacing, radii and shadows come only from the theme tokens (`mobile/` theme file). Palette: ink blue `#2F5D8A`, light blue `#5A8FD0`, glass `#DCE8F2`, plum `#6E2B3F`, brass `#C9A15A`, wax `#A3364F`, navy `#16263F`, paper `#F6F8FB`, cream `#F3E2BB`.
- Type: Noto Serif TC for headlines and numbers, Noto Sans TC for body, LXGW WenKai TC for handwriting and hints.
- Backgrounds: the **paper texture** tile (art) at low contrast on every screen; cards are white paper with a 1.5 px ink border (`#5B6474`) and a soft shadow.
- Icons: hand-drawn feel SVG in code (plum/navy stroke, round caps), drawn from the art session's icon reference sheet. Set: pin, back, close, plus, lock, check, shop, user, map, cabinet, share, camera, pen.
- Vessels: the `Vessel` component renders either the original SVG (`art-svg-v1`) or the new illustrated parts (`public/art` via the manifest). **Keep both**, switchable from a dev setting, so Roy can roll back.

### Layout
- Phone first. Tablet/desktop web: content in a centred column (max 640 px), cards keep their size, several visible.
- Safe areas respected. Primary actions within thumb reach (bottom third).
- Fixed card size: every home card is the same height whatever its text (place on one line with "…", headline wraps as one sentence, centred). This was a reported bug on the web; don't regress.

---

## 1. Navigation map

```
Welcome / Sign in ──► Profile setup ──► Home
Home ─┬─ top-left: avatar "My" ──────► Me ─► Friends / Invite / Edit profile
      ├─ top: 收件 | 寄件 switch
      ├─ top-right: 中/EN, Shop
      ├─ card ───────────────────────► Capsule (inbox: pages 1–3 → Letter) | (sent: Sender view)
      └─ bottom dock:  [Journey]   (＋ New capsule)   [Cabinet]
```
The bottom dock keeps Home clean: a big round ＋ in the middle (as in the prototype), with two smaller round buttons either side for **Journey** (map icon) and **Cabinet** (cabinet icon). No tab bar.

---

## 2. Screens

Each screen lists: **Layout**, **States**, **Interaction & motion**, **Art needs**, **Data**. Owner session in brackets.

### S0 Welcome & sign in [F0]
- **Layout:** welcome scene illustration (top 45%), app name in serif with wide letter-spacing, tagline in handwriting font. Below: "Continue with Google" (Google's standard white button), divider "或用電郵 / or with email", segmented Sign in | Create account, email + password (show/hide), primary button, "Forgot password?".
- **States:** sign in · create account · check your email (verify) · forgot password · check your email (reset) · set new password (from reset link) · invite banner ("Alice invited you…", with her portrait) when opened from an invite link.
- **Motion:** the welcome scene's vessel breathes; switching tabs slides the form (`spring.soft`); errors shake the field once (3 px, 2 cycles) + warn haptic.
- **Art needs:** `scene-welcome`, paper texture.
- **Data:** Supabase auth (email/password with verification, Google OAuth), `invite_info`.

### S1 Profile setup [F0]
- **Layout:** big portrait preview, name, city (optional), portrait picker grid.
- **Interaction:** tapping a portrait springs it up into the preview (`spring.snappy`) + tick.
- **Decided (Roy, 2026-11-06): illustrated portraits.** The picker shows the 8 illustrated portraits (`portrait-01..08`); "未來的自己" uses `portrait-future`. The current mix-and-match SVG portraits stay only as a fallback (for profiles saved before the switch, and until the art is merged). Store as `avatar: { set: 'illus', id: '03' }`; old profiles keep their SVG config and still render. No database change needed (`avatar` is already JSON).
- **Art needs:** `portrait-01..08`, `portrait-future`.

### S2 Home [F1]
- **Layout:** top bar (My, 收件|寄件, 中/EN, Shop), card carousel (vertical middle), dots + summary line ("收到 3 個膠囊，1 個現在可以打開"), bottom dock (Journey, ＋, Cabinet).
- **Card** (fixed size): tags (NEW, 親筆 seal, "Maison Aurèle No.001"), vessel (breathing), headline, place (one line), From/To portrait + name, sealed date.
- **Card states and headline:**
  | State | Inbox headline | Vessel | Extra |
  |---|---|---|---|
  | time | 倒數 **30** 天打開 (h / min under a day) | breathing | |
  | place | 還差 **1.2** 公里 / 要到指定地點才能打開 | breathing | |
  | ready | 現在可以打開 | **glow pulse** (light-blue halo, 2.6 s) | gentle sparkle particles |
  | opened | 已於 11/6 打開 | faded 55% | |
  | sent: time / waiting / opened | 倒數 N 天打開 / 等待對方打開 / 對方已於 … 打開 | | |
  | empty | 還沒有收到膠囊。 / 還沒有寄出膠囊。 | empty-state scene | ＋ hint |
- **Motion:** swipe with momentum, spring snap to centre + tick; centred card scale 1, neighbours 0.9 with 3D tilt toward centre (±8°) and 50% opacity; parallax paper background moves at 0.3×. Tapping a side card scrolls it to centre; tapping the centre card opens it with a shared-element transition (the vessel flies into the capsule screen).
- **Art needs:** paper texture, `scene-empty-inbox`, `scene-empty-sent`, vessels (assembled).
- **Data:** capsules (inbox: recipient = me; sent: sender = me; capsules to yourself appear in both and open the matching view for the tab), profiles, places, vessels, live GPS for place cards.

### S3 Capsule — inbox opening pages [F1] (+ map page [F3])
Swipeable numbered pages on paper sheets, page number bottom-right, dots below.
- **P1 Story:** From (portrait), edition pill for brand vessels, vessel (breathing), story text: before time: "時光膠囊在 *2021/02/13 11:24 am* 發出，已經沉澱了 *2092 天*，還要再等 *30 天*…" + live countdown (天 時 分 秒, numbers roll); after time: "…經過 *N 天* 時間的沉澱，終於在 *date* 送到你的手裡" + (place) "立即出發到 📍place" link → P2, or (no place) "去打開" → last page.
- **P2 Map** (place capsules only) [F3]: real map, the vessel as the pin in a round badge, the place's 100 m circle, you as a blue dot, dashed route line; place name, city, the place's note; distance line ("距離你 65.7 公里…" / "你已經在這裡了"); buttons Navigate (opens Apple/Google Maps) and, when within range, 去打開.
- **P3 Open:** stage with halo + vessel, unlock checklist (time ✓ / place ✓ or 🔒 with distance), sender's hint in handwriting, brand note when relevant, then the action:
  - not yet: disabled button "N 天後才能打開"; place not reached: disabled "到達地點後才能打開" + location status.
  - ready: **HoldButton "長按打開"** + note "打開的時間和地點會被記錄在膠囊上".
- **The opening ritual (most important moment):** hold for 1.6 s. A ring fills around the thumb; haptics **build**; the vessel trembles with growing amplitude (0 → 3 px); light leaks from the lid seams (Skia, light-burst asset at low opacity). Release early: everything springs back (no penalty). Complete: **thump**, the server is asked to open (`open_capsule` with GPS) while the lid lifts off along its pivot with `spring.heavy` and fades up, a light burst + particles, then the letter rises out of the vessel and unfolds. On a server refusal (not yet / too far / inaccurate), the lid drops back, **warn** haptic, and a clear message.
- **Art needs:** vessel parts with pivots (lid / flap / cork), `fx-light-burst`, map pin badge uses the vessel.
- **Data:** `mark_seen` on first view, `open_capsule(p_id, lat, lng, accuracy)`.

### S4 Letter (opened) [F1]
- **Layout:** small faded vessel, letter paper (typed in serif; handwritten 親筆 in the handwriting font with ruled lines and a 親筆 wax mark; drawing image), photo in a polaroid-style frame, signature + "封存於 …", **gift card** for brand capsules (navy card: "Maison Aurèle 為你保管了一份禮物", item, pickup code, real QR, 30-day note), the opening record ("你在 … 於 … 打開了這個膠囊"), "回寄一個膠囊給 X" button.
- **Motion:** letter rises with `spring.soft`; drag up to read; the record line stamps in last (scale 1.2 → 1 + fade).
- **Art needs:** paper texture (letter variant), polaroid frame (can be code).

### S5 Capsule — sender view [F1]
- Title "寄給 X 的膠囊", vessel on stage, vessel name, countdown while waiting, timeline (已封存並寄出 ✓ → 送到 X 手上 → X 打開, with times and place), the blurred "sealed" box ("內容已封存。寄出之後，連你自己也不能再看或修改。"), your hint.
- Matches the prototype screenshot Roy shared.

### S6 Create (4 steps) + Seal & send [F2]
Full-screen sheet with progress bar and "Step n of 4"; Back / Next at the bottom.
1. **Who:** grid of portraits: 未來的自己 first, friends, then "邀請好友" (opens S9 invite).
2. **Write:** Type | 親筆手寫 switch; typed: textarea 500 chars with counter; handwrite: ruled pad, finger drawing, Clear; "＋ 附上一張照片" (camera or library; preview thumbnail, tap to remove); hint field (40 chars, "visible before opening").
3. **Vessel:** grid of all vessels; owned ones selectable; others dimmed with "到商店取得" → opens Shop focused on it, returning here after acquiring.
4. **When & where:** quick chips (一個月後, 半年後, 一年後, 五年後, 自訂日期), "將於 … 送到對方手上"; **Memory suggestions** card (coming soon, AI concierge, never writes the letter); places list (不限地點 + 10 landmarks with city · note + the brand boutique, disabled unless the Maison vessel is chosen); 100 m note.
- **Seal & send ceremony:** the letter slides into view; **drag the wax seal** from the bottom onto the letter: it snaps when close, **thump**, wax squash (scale 1.25 → 0.95 → 1) and a small spread; the letter folds (two creases, `spring.soft`) and drops into the vessel; the lid closes along its pivot (**thump**); the vessel lifts and drifts up/away; screen shows "已封存" + "將於 … 送到 X 手上，要到 place 才能打開。從現在起，連你也不能再看或修改。" + Done (**success** haptic). Done → Home on the Sent tab with the new card first.
- **Art needs:** `seal-wax`, `scene-sealed`, vessel parts, ruled paper.
- **Data:** `send_capsule(... p_place, p_drawing, p_photo)`.

### S7 Shop [F2]
- Featured brand hero (navy): ring box, "Maison Aurèle × 時光膠囊", headline, copy, "尚餘 N / 300" or "你的編號 No.001 / 300", gold button. Then "所有容器" grid (vessel, name, description, MOP price or 已擁有). Fine print: free during testing; fictional brand.
- **Get sheet:** vessel, "購買「X」？", price, "測試期間免費取得，不會收費。", Cancel / 免費取得. On success: the vessel flies from the sheet into the Cabinet dock button (**success**).
- **Data:** vessels, owned_vessels, `vessel_stock`, `acquire_vessel`.

### S8 Journey / Passport [F3]  (new, game layer)
- **Layout:** illustrated Asia map (pinch/pan, starts framed on the user's region), landmark pins (11 incl. boutique); a passport button bottom-right with "N / 10" stamps.
- **Pins:** visited (a capsule opened there): coloured stamp-mini; has a waiting capsule for you: vessel badge with soft pulse; others: outline pin. Tap a pin → card: place name, city, note, "你有 1 個膠囊在這裡等你" / "你在 2026/11/06 於這裡打開過膠囊".
- **Passport:** book that slides up; pages of stamp slots (grey outline until earned). A new stamp is shown with the slam animation once (stamp drops with `spring.heavy`, **thump**, ink spread mask, slight rotation ±6°).
- **Earning:** a stamp = you opened a place-locked capsule at that place (from `capsules` where recipient = me, `opened_at` not null, `place` set). No new tables needed for the first version.
- **Art needs:** `map-asia`, `stamp-<placeId>` ×11, passport cover, passport page.

### S9 Cabinet [F4]  (new, game layer)
- **Layout:** wooden shelves (art) on a wall; your owned vessels on the shelves, free ones first; empty slots show faint outlines of vessels you don't own (tap → Shop).
- **Motion:** gyroscope parallax (shelves and vessels at different depths), a light sheen across glass vessels as you tilt; tap a vessel → it lifts out to centre, spin it horizontally with your finger (inertia), details: name, description, edition "No.001 / 300", acquired date, "used in N capsules".
- **Art needs:** `shelf`, cabinet wall/background, vessels (assembled).

### S10 Me, Friends, Invite [F4]
- **Me:** big portrait, name, city; Edit profile; stats (收到 / 寄出 / 已打開); menu: 語言 (繁中 | English), 好友 N 位 →, 已擁有的容器 N 個 → Cabinet, reminders: "膠囊快到開啟時間時提醒我" and "經過膠囊地點附近時提醒我" (switches saved on the profile; note "提醒功能即將推出" until notifications exist); Sign out.
- **Friends:** list with portraits, "寄膠囊" per friend; Invite button.
- **Invite:** your link, Copy, Share (native share sheet); text "X 邀請你使用時光膠囊…". Opening a link in the app (deep link `timecapsule://` or the web URL) shows the invite banner on sign-in and auto-accepts after sign-in.

### Global elements [F0]
- **Toast:** navy pill above the dock, `fade.quick`, 2.4 s.
- **Language switch:** instant re-render, persisted.
- **Location permission:** ask only when a place capsule needs it, with an explainer card first ("要量度你和地點的距離…"); denied → clear message + "open Settings" button.
- **Dev-only:** fake GPS and the "2 minutes" open time, never in store builds.

---

## 3. Art needs (for the artwork session)

| Asset id | Screens | Notes |
|---|---|---|
| `vessel-<id>` + parts (dome, bottle, envelope, tin, lantern, musicbox, maison) | S2–S9 | Parts stack 1:1 on the canvas; pivots for lid / flap / cork (T9) |
| `seal-wax` | S6 | Large, embossed rose, no letters (T9) |
| `stamp-<placeId>` ×11 | S8 | One colour each (T9) |
| `map-asia` | S8 | 2048², no labels (T9) |
| `shelf` | S9 | Three shelves, transparent (T9) |
| `portrait-01..08`, `portrait-future` | S1, everywhere | Must read at 40 px (T9) |
| `app-icon` (+ exports) | store, home screen | Opaque (T9) |
| `paper-texture` tile | all | Seamless, very low contrast; a slightly warmer variant for letters (T9b) |
| `scene-welcome` | S0 | Vessel on a table by a window, morning light (T9b) |
| `scene-empty-inbox`, `scene-empty-sent` | S2 | Quiet, hopeful (T9b) |
| `scene-sealed` | S6 | The sealed moment (T9b) |
| `fx-light-burst` | S3 | Soft radial light, transparent (T9b) |
| `passport-cover`, `passport-page` | S8 | Navy cover with brass foil feel; cream page with faint guilloché (new, add to T9b) |
| `cabinet-wall` | S9 | Warm wall behind the shelves (new, add to T9b) |
| `icon-reference` sheet | all | Style reference only; icons are SVG in code (T9b) |

The artwork session tells Claude when assets merge (manifest paths + pivots). Screens load art **only by manifest path**.

---

## 4. Ownership (Codex sessions)

| Session | Screens / parts |
|---|---|
| F0 | Foundation, S0, S1, global elements, shared components (`Vessel`, `Avatar`, `CapsuleCard`, `HoldButton`, `Countdown`, `Toast`) |
| F1 | S2 Home, S3 pages 1 & 3 + opening ritual, S4 Letter, S5 Sender view |
| F2 | S6 Create + Seal & send, S7 Shop |
| F3 | S3 page 2 Map, S8 Journey/Passport, location permission + live GPS |
| F4 | S9 Cabinet, S10 Me / Friends / Invite |

Shared files (theme, strings, components) are owned by F0; F1–F4 may **add** strings and small components in their own folders, and propose changes to shared ones in their PR description.

## 5. Open decisions for Roy
1. ~~Illustrated portraits replace the mix-and-match ones?~~ **Decided: yes** (see S1).
2. Bottom dock (Journey · ＋ · Cabinet) instead of a tab bar? (Recommendation: yes; keeps the prototype's calm home.)
3. Final app id and store names (needed before any store build).
