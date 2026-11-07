# Solid wax plus and still Cabinet shelves

PR #47 passed CI at `e46b840` and owner squash-merged as `9743371`. The Home + now uses solid wax-red fills instead of an SVG gradient id. Browser inspection found base fill `#9A2E48`, two soft highlight circles and no linear gradient.

The shelf change removes `idle={item.owned && !selected}` from ShelfSlot. It uses assembled art at rest. The 230 px close-up still passes `idle`; existing tilt/parallax, hover lift/sheen, press and fly-out handlers are unchanged.

## Verification

- Local `npm run typecheck` and `npm test`: pass, 23 tests.
- `npx expo export --platform ios`: pass.
- Browser at http://localhost:8088/cabinet: shelf assembled art stays unchanged between observations; pointer hover reaches scale 1.05 and translateY -6, sheen opacity .13 and parallax transforms. Close-up rose/glint transforms change, and closing returns the slot. Emulated Reduce Motion changes the close-up to the single assembled image; the media override was reset afterward. No browser errors.
- Home at http://localhost:8088: + is wax red, with solid SVG fill and no gradient reference.
- Roy confirmed iPhone Expo Go: wax-red +, still shelves, moving close-up, tilt/press/fly-out/return and Reduce Motion. He reported close-up spin did not respond on native, while web worked. The native pan fix awaits his retest on port 8087.

`browser-checks.json` and the screenshots record the browser results. Both fixes wait for the next combined release after the Vercel quota resets; no separate deployment or release commit.

## Expo Go spin follow-up

The close-up previously relied on PanResponder on both platforms. Expo Go now uses the existing Gesture Handler native pan (5 px threshold, JS callbacks for the current Animated values), with a non-collapsible rotation target and a GestureHandlerRootView inside the native modal. Native velocity in px/s is converted to match the web responder's px/ms decay; cancellation does not start a fling. Reduce Motion disables the native spin recognizer. Web keeps its working responder; a drag after this change produced a rotateY matrix and returned to the slot without errors (`cabinet-spin-web.png`).

Modal setup follows the [Gesture Handler installation guide](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/getting-started/). No dependency was added. Phone retest is required to verify this native fix.
