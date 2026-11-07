# Compact profile prediction record

Roy supplied `Screenshot 2026-11-07 at 18.03.39.png` as the visual reference. This follows its serif prediction text and small muted details, compact row spacing and wax-seal proportions using the existing theme and assets.

- Title: Noto Sans TC, regular, 16 px / 24 px, matching Language/Friends in both languages as Roy subsequently requested. Prediction: Noto Serif TC, 16 px / 24 px, replacing the handwriting font. Metadata/count: Noto Sans TC, 12 px / 18 px. Wax seal: 26 px.
- Profile preview contains only the two newest successful predictions (`verdict === true`, ordered by opening time). A newer un-stamped prediction cannot displace a success. Total success/all-history count is unchanged.
- A compact More pill shares the heading row. It opens the full private history, including un-stamped entries with faint grey seals. Popup uses the existing ink/plum/brass/paper palette, rounded white frame, dim backdrop, bounded scrolling and a 44 px close target. Escape, backdrop, native request-close and Reduce Motion paths are supported.
- Removed the no-leaderboard/streak/score sentence in both languages. Distinct empty-history and no-success states; More remains available for nonempty history even when no entry is successful.
- Existing live RPC, ownership protections, names lookup and focus refresh are unchanged. No migration, dependency, settings, illustration or production changes.

## Verification

At http://localhost:8088, 375 × 812 and 1280 × 900:

- Local sample data deliberately put a newer un-stamped record before three successful records. Exactly the two newest successes appeared in the preview; the older success and all other records appeared in the popup.
- Both languages fit the compact header at 375 px. Computed title uses NotoSansTC at 16 px/400, matching the profile rows; prediction text uses NotoSerifTC at 16 px with 24 px line height. The two-record card is 170 px high at phone width.
- A 30-record history scrolled within the panel (2,364 px content / 593 px viewport); the close control stayed visible. Close, Escape and backdrop all dismissed it. Reduce Motion opened/closed without the fade.
- Empty and no-success states checked, as well as the actual Me integration with existing data. No browser console errors; the requested sentence is absent.
- Test fixture route was local only and removed before export/commit. No database fixtures were added or changed. Viewport, language and emulated motion settings restored.

Phone and desktop evidence is in the PNGs in this folder (captured before Roy’s final heading-only sans-serif adjustment). The final live profile heading was checked against the Language row: both compute to NotoSansTC, 16 px, weight 400. Run locally from `mobile/` with `npm run web` (port 8088). Physical Expo Go appearance is not verified on this Mac. Merge/deploy are not part of this request; retain the next combined-release gate.
