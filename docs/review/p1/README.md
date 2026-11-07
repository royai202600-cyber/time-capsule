# P1: Predict me backend and release review

Migration: `20261107092428_predict_me_capsules.sql`, applied to hosted project `uzimuygyxwraybsipeij` with the CLI. PR #58 was refreshed from main; conflict resolution keeps prediction kind/input/sealed wording alongside PR #55's wax steps and seal loaders.

## Backend and compatibility

- Additive kind/verdict metadata and sealed prediction text, with trimmed 1–140 character validation. Prediction-only capsules satisfy the content constraint; ordinary letters still require their original message/drawing content.
- `send_capsule` gains trailing defaults; old callers keep working. `open_capsule` keeps all seven existing columns and appends prediction/verdict.
- A definition comparison against the live pre-migration send/open functions confirms every original body/guard is unchanged outside the intentional prediction validation, writes and return columns (`guard-audit.json`). This includes ownership/friendship, time/place/GPS, opening row lock/gift, voice duration/path/owner/existence/reuse/serialization and grants.
- Verdict: only the opened prediction's recipient, true/false/null, mutable. Clearing sets verdict and verdict_at to null. Sender lookup returns exactly prediction/verdict/verdict_at after opening. Record is caller-relative with one sent row and null other for self-capsules.
- All five functions lock search_path to empty; anon cannot execute any. New RPCs grant only authenticated. Existing send/open retain their authenticated and service_role grants. capsule_contents retains RLS with no client policies or grants.
- Regenerated database.types.ts remains the generated output. The client has one documented type override for the nullable verdict argument: the generator incorrectly describes PostgreSQL nullable RPC inputs as non-nullable. No never casts, local prediction stub, duplicate-message fallback, new dependencies or settings changes.

## Migration sequencing

The repository's older `20261107073919_add_batch1_vessels.sql` remains UNAPPLIED. A temporary CLI push workspace contained the already-applied migrations plus P1, excluding that held file. Dry run listed P1 only; `supabase db push --remote=uzimuygyxwraybsipeij --skip-vault --yes` applied P1 only.

Afterwards a repository dry run with `--include-all` lists only the held catalogue file. The DB still has seven vessels. At the next authorized combined release: deploy and confirm the new frontend first, then dry-run/apply the catalogue using `--include-all` because its version predates P1. No catalogue rows were added during this task. Fortune-cookie preselect remains unavailable until then.

## Live security checks

`node supabase/tests/predict-me-api.mjs /path/to/private-fixtures.json /path/to/test.m4a` runs the assertions. Provision three confirmed disposable users/profiles and a bidirectional friendship for the first two; the harness refuses non-fixture email addresses. All assertions use the public anon key and real user JWTs, never service_role. The harness persists exact created IDs/paths privately for cleanup.

18 groups passed; see `security.json`. Coverage includes anonymous denial, sealed table/read/patch denial, sender/third-party denial, pre-opening verdict/time lock, validation and existing guards, narrow sender output, true/false/null mutations, record roles/self deduplication, old letter arguments, actual voice upload/download bytes, read restrictions and concurrent attachment reuse. Both voice objects were then removed through the authenticated admin Storage API (CLI), fixture sessions revoked, and three auth users deleted with cascading test records. Verified zero fixture users/profiles/capsules/objects remain. No real capsule data was changed.

Security advisors retain the pre-existing anonymous warnings for invite_info/rls_auto_enable and password protection. The new functions only add expected authenticated definer notices: they need narrow privileged access to the sealed table and enforce ownership internally. No new anonymous executable functions or table exposure were added. References: [function privileges](https://supabase.com/docs/guides/database/functions#function-privileges), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [definer advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [existing anonymous-function advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [existing password advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The no-policy capsule_contents advisory is intentional sealing.

## App verification

- `npm run typecheck`, `npm test` (23 passed), web and iOS exports passed. Final PR CI must pass before merging.
- Local app: `cd mobile && npm run web` → http://localhost:8088, tested at 375 × 812.
- Disposable sender sent prediction-only capsules to its friend in English and itself in Chinese using the two-minute option. No DB time override was used. Home tags, sender sealed view, hold-to-open, stamp/un-stamp/re-stamp and opened sender projection passed. Clearing a stamp persisted across reload. Each prediction appears once, without the old duplicate letter fallback.
- Me shows both records, caller-relative labels and the true count in zh/en. Console had no app errors. The fixture browser was authenticated with a normal public-key password exchange after the browser input target lost focus; that session was cleared afterwards. No admin tokens or test harness were injected into the app. Temporary viewport was restored. Physical Expo Go remains Roy's later check.
- Screenshots: `home-zh.png`, `sender-sealed-zh.png`, `friend-stamped-en.png`, `friend-unstamped-en.png`, `sender-opened-en.png`, `self-stamped-zh.png`, `record-zh.png`, `record-en.png`.

Frontend production release stays queued. Do not deploy separately or apply the held catalogue migration.
