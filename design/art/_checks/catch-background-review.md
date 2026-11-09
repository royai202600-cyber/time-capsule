# Time Capsule catch background options

Step 1 only. These are the original first-batch three options generated from Claude's brief with Codex's built-in `gpt-image-2`. Later self-directed revisions are excluded. Design review and the choice belong to Roy and Claude Code.

All three originals are copied byte-for-byte at native opaque 1024×1536; no resaving or upscaling. The first-batch prompt set and ordered references are recorded in [catch-background-prompts.json](catch-background-prompts.json). The approved style sheet was first on every call, followed by the fight and map screenshots.

Screenshot references were read with `git show` from `claude/time-capsule-game-journey`, commit `b5f584d7e04681af8eaf613cdc55aa7fd8350dad`. They are not recommitted as files. The fight screenshot appears only as the requested comparison panel in the sheet.

[Comparison sheet](catch-background-options.png): current screenshot on the left, then options 1–3, each at 375×812 with a centred cover crop. Only technical checks were run for this delivery: exact size, opacity, crop dimensions, prompt/style-reference records and preservation of all existing files.

```sh
/tmp/timecapsule-concept-venv/bin/python design/art/_checks/catch-background-review.py
git diff --check
```

Stop for Roy's pick. No production master, WebP export, manifest/README registration, exporter change or Decisions-log pick is made at this stage. No app code, database, settings or deployment changes. The PR remains draft and unmerged.
