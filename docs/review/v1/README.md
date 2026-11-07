# V1 sealed voice notes

Backend migration: `20261107062233_sealed_sender_voice_notes.sql`, applied to hosted project `uzimuygyxwraybsipeij` with Supabase CLI 3.0.0. No auth/config push and no existing user data changed.

The private bucket permits only new uploads under the authenticated sender's UUID folder. It accepts the requested audio MIME types up to 2 MiB. The RPC verifies path, object ownership, duration metadata (500–60000 ms) and unique attachment. It locks the upload during attachment to prevent simultaneous sends reusing a recording. No client UPDATE or DELETE policy exists.

`capsule_contents` still has RLS with no client policies. A narrow `private.can_read_capsule_voice()` boolean helper authorizes Storage only when the caller is the capsule's recipient and `opened_at` is set. It uses a fixed empty search path and an explicit caller check, with no anonymous execute grant. The private schema is not exposed through PostgREST. Senders distinct from recipients cannot download, sign or list their stored note, even after opening. A self-capsule becomes readable through its recipient permission only after opening.

The old send overload is replaced with two defaulted trailing arguments, keeping old clients compatible. Open's two new trailing columns required atomic DROP/CREATE; the existing time, place, GPS, serialization and gift-code body is preserved. Existing authenticated and trusted service-role grants are retained, with no PUBLIC/anon execute. `has_voice` is the only new public capsule metadata. Types were regenerated from the hosted schema and temporary RPC/result casts removed.

## Verification

`backend-security.json` records 16 passing groups of live HTTP/RPC assertions with three generated fixture users. No service-role key was used for assertions. Fixture users/sessions were signed out and removed; actual fixture blobs were removed through the admin Storage CLI, never by deleting metadata rows. An initial cleanup attempt encountered the CLI's experimental-command guard; it was corrected, its fixtures removed, and the complete suite rerun successfully. No real accounts or capsules were changed.

To repeat explicitly, use a small real M4A fixture and an authenticated Supabase CLI:

```sh
node mobile/scripts/test-voice-storage.mjs --live --audio /absolute/path/test.m4a
```

The script refuses other target hosts. Passwords and SQL files stay in a private temporary directory and are removed after successful cleanup. It tests own-folder upload, wrong-folder/duplicate/type/size denial, download/sign/list denial, sealed table denial, RPC validation, concurrent sends/opens, self-capsules, immutable files, no-voice compatibility and time/place/GPS guards.

The migration first passed a hosted transaction/rollback preflight. Mobile unit tests and TypeScript pass. Web/iOS exports and physical device results are recorded in the release report.

## Device checks

Roy confirmed the requested iPhone Safari and Expo Go SDK 58 checks: microphone permission, moving meter/timer, stop/play, re-record/delete, 60-second auto-stop, music pause/resume and the two-minute self-capsule send/open/playback including playback of the Expo Go recording in Safari. The web recorder was also checked at 390 px on localhost:8088 (`create-recorder-390.png`). Expo Go uses its host application's iOS permission dialog; the custom bilingual microphone string was verified in the generated iOS Info.plist via `expo config --type introspect`, but requires an app/development build to verify the installed dialog. See [Expo permissions](https://docs.expo.dev/guides/permissions/).

Production previews keep the dev two-minute option hidden. Use Expo Go's dev option for a two-minute self-capsule; the same opened note can then be played in the Safari preview. Safari-origin recording can be checked on the HTTPS development server for the reverse cross-platform send/open check, while retaining the production-only checks on the preview.

## Orphan cleanup follow-up

A recording uploaded but never attached stays unreadable. A scheduled privileged Storage API cleanup for unattached objects older than 24 h is deferred; attached objects must be rechecked and preserved. Do not use direct SQL DELETE on `storage.objects`, which can leave orphaned blob bytes.

## Release verification

Backend PR #43 squash-merged as `6b332ad` into the UI branch; combined PR #40 passed CI on `ea890a9` and owner squash-merged to main as `04d1e71`. After main integration, 23 local tests, TypeScript and iOS export pass. Local browser checks confirm the recorder remains available and the alarm preview Stop returns Home with no browser errors. The existing W1 alarm delivery/snooze phone checks remain separate from V1.
