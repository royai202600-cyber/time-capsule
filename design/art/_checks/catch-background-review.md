# Time Capsule catch background — approved Option 3

Roy chose Option 3 on PR #84 exactly as it is, with no more trees and no redraw. `design/art/game/catch-background.png` is a byte-for-byte copy of the selected `option-3.png` at `6acd9e32a391b0c35a3b0730f15e40be42a425fe`. The chosen source stays in the options folder; the two unchosen PNGs are removed.

The exact selected prompt was recovered and verified against the original image generation record `6a778803-827a-486a-89e9-609d949837b7` (Overcast calm). It is recorded in the selection record in [catch-background-prompts.json](catch-background-prompts.json), the manifest entry and the art README. Model: Codex built-in `gpt-image-2`. Ordered references: approved style sheet, supplied fight screenshot, supplied map screenshot. Screenshot source commit: `b5f584d7e04681af8eaf613cdc55aa7fd8350dad`; reference files are not recommitted.

The new WebP is opaque at the full 1024×1536. Only the exact `game/catch-background.png` path bypasses the existing 512 px game export rule. No other export changes.

```sh
SHARP_MODULE_DIR=/tmp/timecapsule-game-final-tools/node_modules/sharp node design/art/scripts/export-webp.cjs --only game/catch-background.png
/tmp/timecapsule-concept-venv/bin/python design/art/_checks/catch-background-review.py
git diff --check
```

The technical check invokes the existing STYLE.md asset checker in a temporary directory with the explicitly approved opaque/portrait overrides for this asset. It checks exact PNG identity, full resolution, opacity and export alpha; the unchanged old manifest entries, existing artwork and exports; the single exporter exception; and the one-line AGENTS.md pick. It writes the [STYLE check](catch-background-style-check.json) and [preservation audit](catch-background-audit.json). It does not regenerate or review the design.

[Comparison sheet](catch-background-options.png) shows the supplied current screen and Roy's chosen Option 3, both at 375×812 with a centred cover crop. No production app/browser/device integration is claimed. No app code, database, settings or deployment command is included. Roy authorized owner-account squash merge after green technical checks and CI.
