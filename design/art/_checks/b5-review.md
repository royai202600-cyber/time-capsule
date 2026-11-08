# B5 food and travel art review

All ten vessels are art only. App screens, catalogue rows and physical-phone verification are separate.

[Contact sheet](b5-contact-sheet.png) · [40/120 px strip](b5-sizes.png) · [Interactive WebP review](b5-review.html)

| Vessel | Opening | Review |
|---|---|---|
| hot-air-balloon | B | [motion](hot-air-balloon-motion.png) · [40/120 px](hot-air-balloon-silhouette.png) |
| bubble-tea | C | [motion](bubble-tea-motion.png) · [40/120 px](bubble-tea-silhouette.png) |
| dim-sum-steamer | B | [motion](dim-sum-steamer-motion.png) · [40/120 px](dim-sum-steamer-silhouette.png) |
| bento | B | [motion](bento-motion.png) · [40/120 px](bento-silhouette.png) |
| paper-cranes | G | [motion](paper-cranes-motion.png) · [40/120 px](paper-cranes-silhouette.png) |
| heart-locket | J | [motion](heart-locket-motion.png) · [40/120 px](heart-locket-silhouette.png) |
| suitcase | A | [motion](suitcase-motion.png) · [40/120 px](suitcase-silhouette.png) |
| postbox | J | [motion](postbox-motion.png) · [40/120 px](postbox-silhouette.png) |
| camp-lantern | C | [motion](camp-lantern-motion.png) · [40/120 px](camp-lantern-silhouette.png) |
| treasure-chest | A | [motion](treasure-chest-motion.png) · [40/120 px](treasure-chest-silhouette.png) |

## Technical corrections

- Bento draws box → lid → knot. The knot is gone at 0.35, then the lid lifts. Roy corrected the brief’s order.
- [Locket idle extremes](heart-locket-idle-review.png) · [Lantern glow range](camp-lantern-idle-review.png).
- A still stand layer lets only the locket back/chain and front sway 4° around the chain attachment; no ground layers.
- The lantern has an extra still backing so a soft, separate halo can flicker behind the glass while its flame remains present. Opening glow keys remain opacity 1 → 1.
- Bubble tea uses a thin sealed film with its straw, replacing the initial cloth-like draft.
- Glass/clear-plastic fills are marked before adjust-glass-alpha.py sets them to approximately 37.6%; outlines and highlights are preserved. Complete contents remain static.
- Isolation edits that changed position/scale were fitted to the source geometry before the common downscale; no part is upscaled.
- The approved hot-air balloon PNG/WebP bytes and motion remain fixed, including its basket rope ends.

## Art and IP

Original generic objects with no logo, text, real brand shape, royal cipher or character. Suitcase stickers are abstract waves, not country flags. No unresolved IP concern found in the visual review. Natural food colours are limited to food, per Roy’s approved STYLE.md exception.

## Review status

Local checks: ten exact raw CLOSED stacks, 36 alpha-exact WebPs, 261/261 PNG masters, 452 existing/approved artwork hashes and root build pass. The browser tool rejected the file URL; the page has only been syntax-checked and static sheets were visually inspected.
Roy approved PR #70 on 2026-11-08; merge follows fresh checks and green CI. These review controls reproduce the manifest transforms in a standalone page; they do not constitute screen integration or a physical-device test.
