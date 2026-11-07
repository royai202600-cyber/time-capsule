# Solid wax plus and still Cabinet shelves

PR #47 passed CI at `e46b840` and owner squash-merged as `9743371`. The Home + now uses solid wax-red fills instead of an SVG gradient id. Browser inspection found base fill `#9A2E48`, two soft highlight circles and no linear gradient.

The Cabinet code change removes only `idle={item.owned && !selected}` from ShelfSlot. It uses assembled art at rest. The 230 px close-up still passes `idle`; existing tilt/parallax, hover lift/sheen, press, spin and fly-out handlers are unchanged.

## Verification

- Local `npm run typecheck` and `npm test`: pass, 23 tests.
- `npx expo export --platform ios`: pass.
- Browser at http://localhost:8088/cabinet: shelf assembled art stays unchanged between observations; pointer hover reaches scale 1.05 and translateY -6, sheen opacity .13 and parallax transforms. Close-up rose/glint transforms change, and closing returns the slot. Emulated Reduce Motion changes the close-up to the single assembled image; the media override was reset afterward. No browser errors.
- Home at http://localhost:8088: + is wax red, with solid SVG fill and no gradient reference.
- Physical iPhone Expo Go confirmation is pending on the candidate served on port 8087.

`browser-checks.json` and the screenshots record the browser results. Both fixes wait for the next combined release after the Vercel quota resets; no separate deployment or release commit.
