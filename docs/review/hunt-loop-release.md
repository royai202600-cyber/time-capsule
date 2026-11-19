# Combined hunt-loop release

## Acceptance complete — #178 live

Reviewed #178 at `d2373c5e8de32231e4a3578549c91e40b0421c7d`. TypeScript, Vitest (265 passed, 9 skipped), CI `44503714409` and web export passed. Roy's account squash-merged `8e01f8cf38e6bf451c259f46f102779c83099dff`. Owner release `b3ee1251b434080ff2af543b0d1f8ba60b78e306` is live at https://time-capsule-pi-two.vercel.app. Vercel deployment `B3y2y2YnajFk3GCdL6sxfDEKAu5h` succeeded. Production served the export's `__common-b9bfb0e35a7e8e01dab1e8981797c357.js` and `entry-7eba965b12c75d10b710d27aa00e57a6.js`. Main's live types match `8cf3a2a`.

At 375 px with simulated GPS, the authenticated fixture reached 7/8 with the legacy Spin and Restore counts at zero. The Keeper pin had no check mark. Winning the Taipei 101 fight showed “Unlimited copies” for the Bamboo-tier tower tin. Closing the fight updated the checklist to 8/8 and the Keeper pin to ✓ without reopening Journey. Quests → Show on map took the player to the Keeper, and Take it issued the City Hunt stamp, 2 gold wax balls and 20 XP. Passport displayed the stamp. The duplicate authenticated claim returned “already finished”. A second fight in Traditional Chinese displayed 「無限份數」 and awarded no additional Landmark XP or stamp. The completed hunt showed its finish date and had no claim button or Keeper check mark. The database confirmed one City Hunt stamp, a single 20 XP event for the hunt, a two-ball payout, and one Landmark stamp and XP event across both wins.

Removed the disposable account, hunt, quest rules, progress, spawn, catches, fight attempts, ownership, XP, stamps, sessions and Auth records. All fixture counts verified zero. The pool still has 220 rows. Hosted history contains all eight combined migrations. Macau `20261119000708` remains unapplied for its separate midnight window.

HL-U1–U5, HL-C1–C5 and HL-Q1 are Done. The earlier sections retain the evidence for racks, copies, Today's Hunt in four cities, the five located City Hunt quest types, friend and Memory Routes, and admin checks, including Undo. The optional separate Today's Hunt terminal-arrow browser check was not repeated. The shared arrow logic passed Vitest and the production City Hunt and route checks in #176.

## Previous resume — #177 live, Landmark reward copy label stop

Reviewed #177 head `8fe38ccadb03e053c8170b3a43f5de0f4c2ecd11`. TypeScript, Vitest (262 passed, 9 skipped), CI `44501919877` and web export passed. Roy's account squash-merged `d2b04e4edf53c56e54ad45635a9eb52b0672443b`. Identical-tree owner release `fe53bb439e58f97928d7cf0da9013e6cfb62ea51` is live at https://time-capsule-pi-two.vercel.app. Vercel deployment `EEKme3oaP1ZEpHVZGA99YYEJqngM` succeeded. Production serves the export's entry bundle `entry-c95f4728b8d13a36df2c48479c505720.js`. Main's live types match `8cf3a2a`.

Prepared an eight-quest disposable hunt through the live authenticated API. Keeper check-in and the first six quests reached 6/8, with all four third price misses returning zero points. At 375 px, with simulated GPS and a throw-ball balance for the fixture account, caught its Pineapple cake and closed the throw screen. The checklist showed 7/8 and unlocked Landmark in the same Journey view. Won the Taipei 101 fight with six gold wax hits and closed the result screen. The checklist showed 8/8 in place. The database confirmed all eight completions. Both refresh checks passed.

**Stop on the Landmark win copy label.** The Bamboo-tier tower tin win showed “0 copies left”. Its ownership is unlimited in production (`vessels.unlimited_copies = true`, `owned_vessels.copies = null`). The finite catch result correctly displayed three copies. `mobile/src/services/game.ts:226` converts the Landmark RPC's null copies to 0 and `ThrowScreen.tsx:470` uses that count for the result label. Claude should preserve the unlimited value across the result and render it accurately. The ordinary throw result adapter at `game.ts:170` has the same null-to-zero conversion and should be checked as part of the fix.

The Keeper return and once-only reward/stamp checks were held under Roy's stop instruction. Source review identified a related risk for that next check. `readyToReturn` in `cityHunt.ts:53` still reads the legacy checklist, and the completed fixture had spin/restore counters of zero despite 8/8 located completions. KeeperCard and Show on map use this legacy readiness. This was not exercised in the UI after the stop. Check that the Keeper accepts the located completion and that the server grants the reward and stamp only once. The optional Today's Hunt price check and Done-doc merge remain pending.

Signed out, reset the viewport and reloaded to clear simulated GPS. Removed the disposable hunt, account, rules, progress, throw spawns, catches, fight attempt, XP, stamps and ownership. Verified zero fixture records. Pool count remains 220 and Macau `20261119000708` remains unapplied.

## Previous resume — #176 live, Catch progress refresh stop

Reviewed #176 head `570bafbc9e0340256a051e2990c9bb34040e0f1c`. TypeScript, Vitest (262 passed, 9 skipped), CI `44499655877` and web export passed. Roy's account squash-merged `8425266d11e102319c84d45cda7b43283988f2d8`. Identical-tree owner release `a5ceba5b7838737b808ce3c38a935367f4fd353e` is live at https://time-capsule-pi-two.vercel.app. Vercel deployment `F6T8wzHVSFHLips9m7Bs66czXd6C` succeeded. Production serves `__common-3e545b21d641f7cbefd88382d4e6e56b.js` and `entry-12edbfc09a11e053dd34052335135f86.js`, matching the export. Main's live types match `8cf3a2a`.

A disposable eight-stop City Hunt used simulated GPS and an allowance for that player only. Keeper check-in, Arrive and Question passed. At 375 px in English and Traditional Chinese, terminal guesses above US$3.04 showed Lower and guesses below showed Higher. The countdown moved 3 → 2 → 1 and reopened at the persisted 2. The Chinese second countdown was also checked at 1280 px. All four third misses completed without a points award, and the server recorded three tries and completion for each. A one-stop disposable Memory Route created through the real send RPC showed the same countdown and correct final Lower arrow at 375 px, recorded 1/1 stops walked and enabled the capsule's hold-to-open action. The optional live Today's Hunt price check was not run.

**Stop on stale Catch progress after the successful throw.** Started Catch × 1 from the checklist, saw the quest spawn, and verified a replacement appeared after the first capsule broke free. Restored the replacement Pineapple cake through the usual throw screen, with normal odds. Add to Cabinet returned to Journey. Quests still showed 6/8, Catch incomplete and Landmark locked. The server had already recorded `caught = 1` and `completed_at` for the quest. Leaving and reopening Journey loaded 7/8 and unlocked Landmark. Screenshots capture both states.

The throw completion handler in `mobile/src/features/journey/JourneyScreen.tsx:702` calls `loadGame()` but does not refresh the located quest lists. The active hunt IDs and timestamps used by `usePinQuests` did not change, so it kept the pre-throw rows and pins. Claude should refresh quest progress after the game screen closes and verify Catch, Landmark and the corresponding route stops without leaving Journey. Landmark fight, Keeper return and the Done-doc merge remain held under Roy's stop instruction.

Signed out, reset the viewport and reloaded to clear simulated GPS. Deleted the disposable account, progress, hunt, route capsule, rules, spawns, catches and ownership. Verified zero fixtures and related records. Pool count remains 220 and the audit trigger is enabled. Macau `20261119000708` remains unapplied. No existing hunt, pool, calendar or game settings were modified.

## Previous resume — #175 live; final price hint stop

Reviewed #175 head `e2d4caf01348b04400717747d3e2fa117278e883`. TypeScript passed; Vitest 259 passed / 9 expected skips; CI `44497961041` passed; web export exited successfully. Roy's account squash-merged `540388ec709e790c7416c85462f7c8e76d1b84f9`. Identical-tree owner release `bbc66675f22fab443d9d7a09b43cd5516c02fca5` is live at https://time-capsule-pi-two.vercel.app, Vercel `FYWsDvGKwLTjsJ65GGn2BUdZQd5C` successful. Public script paths match the export: `__common-371f8ca9d161d88f64904c9b7796d727.js`, `entry-f5910f56307387693a908b4f9eaf46dd.js`. Main's database types still match `8cf3a2a`. No backend, migration, flag or art change.

Production used a disposable account and six-stop hunt (Arrive, Question, two prices, Catch and Landmark), with simulated GPS and a fixture-only speed allowance. Keeper check-in, Arrive and Question passed. English price at 375 px showed 3 → 2 after a wrong US$1000 guess. Closing and reopening retained 2. At desktop 1280 px the second miss showed 1; the third miss completed the quest, removed the input, revealed US$3.04 / NT$100 and showed Done without a points award. Database verification confirmed three attempts and a completion timestamp. The grading/attempt contract returns 0 points for this failed completion. Thus the observed stale count was fixed, including persisted count on reopening.

**Stop: the final wrong price guess displays the wrong directional hint.** The third US$1000 guess against a revealed US$3.04 answer displays “↑ Higher”; it should not instruct the player to raise an already excessive guess. The prior wrong guess correctly displayed Lower. Screenshot saved as `city-hunt-final-hint.jpg` in this chat's visualization directory.

Cause: the grading function deliberately omits `hint` when `done` is true and supplies `correct_answer`. `mobile/src/features/quests/QuestPlay.tsx:79` appends a row using `out.hint ?? "higher"`, inventing Higher for the final miss. Claude should derive the final direction from the revealed answer or use an appropriate terminal mark instead of guessing a direction. The same fallback exists in `mobile/src/features/todaysHunt/TodaysHuntScreen.tsx:190`; inspect that shared behavior too (not re-tested in production this resume). No screen or migration fix was made by Codex.

Per Roy's stop instruction, Chinese price coverage, optional route price, Catch/Landmark/return completion and final Done/status-doc merge remain held. Earlier checklist zh/en viewport coverage, Memory Route and admin acceptance remain passed.

Cleanup: signed out, reset viewport and fully navigated to clear simulated GPS. Removed the disposable hunt, six rules, legacy/located quests and progress, account/profile/identity/sessions/refresh tokens/Auth audit records and speed allowance. All fixture counts verified zero, including spawns, player game state, ownership, passport stamps and admin actions. No existing hunt/Q1/calendar/global state was modified. Pool remains 220; audit append-only trigger enabled; Time Capsule Docker stopped. Macau `20261119000708` remains unapplied. No credential helper files were created.

## Previous resume — #174 live; stale price-attempt count stop

Reviewed #174 head `3575efb1f27fb7b7a8a69adbc15ea1ffb7b0c702`. TypeScript passed; Vitest 259 passed / 9 expected skips; CI `44495020993` passed; web export passed. Roy's account squash-merged `c5aec85669e376ea4e270c670f445fb8ffee72ec`. Identical-tree owner release `5e3f879801f0f9f16ff34a1baf5af5b85796911a` is live at https://time-capsule-pi-two.vercel.app, Vercel `G3DK12rBunk5DXczRjguMFr3dpRe` successful. Public script paths match the export: `__common-d433445c5b1279b580fd9afc770b77a7.js`, `entry-f5910f56307387693a908b4f9eaf46dd.js`. Backend flags remain on; live types on main match `8cf3a2a` exactly. No migration, backend or art change.

Production acceptance used a disposable account and five-type City Hunt, with browser-simulated GPS and a fixture-only speed allowance. Before Keeper agreement the sheet showed only Meet the Letter Keeper. After check-in, English and Chinese at 375 × 812 and 1280 × 900 showed all five located rows: Arrive, Question, Guess the price, Catch × 1 and Landmark, with names, points, correct 0/5 count and ordered locks. Tapping the open row closed the sheet and opened its card at the pin. Arrive completed for +20; its row became checked/struck through, count became 1/5 and Question unlocked. The question's wrong choice showed two tries left; the right choice completed for +20. After changing language and reopening Journey, the sheet retained 2/5, and the price row opened its correct card. Thus #174's checklist acceptance passed.

**Stop: the City Hunt price card retains “3 guesses left” after a wrong guess.** At 375 px in English, submitted US$1000 against the disposable Taiwan Design Museum price snapshot. The card added the guess and Lower hint, but still showed 3 guesses left. Read-only database verification confirmed `tries = 1`, `completed_at = null`; the correct remaining count is 2. This is not a rejected request or fixture setup error.

Cause: `mobile/src/features/quests/QuestCard.tsx:100` renders `quest.price.tries_left`. `QuestPlay.tsx:72–76` receives the attempt result and appends a mark, but does not retain `out.tries_left`; Journey's `pinQuest.quest` remains the object captured when opening the card even though the background quest list refreshes. Claude should update the displayed remaining attempts from the server result while the card stays open, preserving restored counts when reopening, and check both City Hunt and route use of this shared card. No screen fix was made by Codex. Test 3 → 2 → 1 → third miss completes for 0 points in zh/en, including reopening after a miss.

Per Roy's stop instruction, no further guesses or Catch/Landmark/return completion were attempted. Those remaining City Hunt checks and final Done/status-doc merge remain held. Prior Memory Route and admin acceptance remain passed.

Cleanup: signed out and reset the browser viewport; full navigation removed simulated GPS. Deleted the disposable hunt, five rules, legacy/located quests and progress, account/profile/identity/sessions/refresh tokens/Auth audit records, speed allowance and cascaded player state. Verified all fixture counts zero, including spawns, ownership, passport stamps and admin actions. Existing hunts, Q1 rows, calendar and global settings were unchanged; pool remains 220 and audit append-only trigger enabled. Time Capsule Docker is stopped. Macau `20261119000708` remains unapplied. No credential helper files were created this resume.

## Previous resume — #173 live; City Hunt legacy checklist stop

Reviewed #173 head `b478b4af1e022e34f8774abaa5db8d1936e14f27`. Function-valued notice setters are wrapped correctly and render with the current language. TypeScript passed; Vitest 259 passed / 9 expected skips; CI `44487941530` passed; web export passed. Roy's account squash-merged `2d0044139bb449bab099bc978e969846a95de285`. Identical-tree owner release `02f411d4a3d8f707a72416b3c3350a1b7554a9eb` is live at https://time-capsule-pi-two.vercel.app. Vercel deployment `7pzdgtS1Km1aL6foXFKejKvFGmdK` succeeded. Production script paths match the export: `__common-26fccf0efebb6978a78d8622a8f18406.js`, `entry-bbfba0957cd6f341c8255880a59262d8.js`. ADMIN_BACKEND, ADMIN_EDIT_BACKEND and ADMIN_HUNT_LOOP_BACKEND remain true. No art or migration change.

Completed checks:

- Production rack at 375 px: remove the disposable capsule in Chinese, switch to English without leaving the Waypost, observe “Removed. Undo is in Activity.”; switch back and observe the Chinese notice again. Activity Undo restored the capsule; the audit entry and refreshed Activity UI confirmed it. The browser's confirmation call timed out despite the action completing, so the page was refreshed before verification; no substitute backend Undo was used for this rack check.
- Copies adjustment saved and displayed its result. Its containing vessel group remounts on a language change, closing the sheet, so the additional persistent-notice check used Question Pool instead. Saved a disposable draft; its mounted sheet changed Saved → 已儲存 → Saved, including desktop width. Because a sheet covers the header language control, this check used a programmatic DOM click on that existing button; it did not change application state directly or add a production patch. The normal rack language switch remained fully user-visible and clickable.
- English desktop calendar question and price pickers loaded the full lists and were visually checked at 1280 px. No calendar mutation occurred. Earlier page-2 selection/Undo and Chinese/mobile coverage remain recorded above.
- A disposable City Hunt copied the existing system-hunt structure and added one of each located quest type, with ordinary catch odds. A disposable-player-only speed allowance supported simulated walking. After joining and agreeing with its Keeper, five blue numbered pins appeared and the Keeper card listed the five correct stop names.

**Stop: the Quests sheet still renders the legacy City Hunt checklist and count.** At 375 px after Keeper check-in, Quests → City Hunt showed “1 / 5 quests”, Meet the Letter Keeper, “Spin Wayposts in the area” 0/3, Restore Corrupted Capsules 0/5, Win the Landmark fight, Return to the Letter Keeper. It omitted the actual question and price quests and used catch 5 although this fixture's catch rule required 1. The map/ Keeper used the new located rules, so these two views disagree. This is not only fixture setup: read-only production verification confirmed Xinyi's located rules are Arrive ×3, Catch, Landmark while its legacy summary remains checkin/spin/restore/landmark/return.

Cause: `mobile/src/features/hunt/HuntViews.tsx:137` maps `hunt.quests` in `huntTasks`; QuestSheet at lines 217–220 builds the card from those legacy tasks and counts them. The new `cityHuntQuests.list`/`usePinQuests.cityQuests` data reaches the map and Keeper, but not this sheet. `mobile/src/features/hunt/strings.ts` still supplies the old Spin instruction. Claude should wire the City Hunt sheet to the authoritative located quests and their completion/count, preserving the separate Keeper start/return actions. Do not merely rename Spin to Arrive: the sheet must support question/price/catch/landmark and actual goals. Test the ordinary three-Arrive city route and all five types, before/after Keeper agreement and after progress, in zh/en. No screen or backend fix was made by Codex.

Per Roy's stop instruction, all-five-type completion (including third price miss = 0), remaining City Hunt checks and any outstanding viewport coverage stay pending. Memory Route and previously passed rack/copies/calendar checks do not need wholesale repetition. Done/status-doc merge remains held.

Cleanup: the rack removal was undone in Activity before fixture deletion. The latest disposable copy adjustment was undone; undoing the older adjustment was refused as stale by the existing audit guard, and the fixture ownership was then deleted with its account. No existing player's balance changed. The draft pool row, capsule, disposable hunt, five quest rules, located/legacy progress, two accounts/profiles/identities/sessions/refresh tokens/Auth audit records, membership, fixture admin actions/secrets and speed allowance were removed. Verified all fixture counts zero; pool 220; audit append-only trigger enabled. No existing Q1/calendar/hunt/global setting changed. Browser signed out, viewport reset, navigation cleared simulated GPS, and credential helpers removed. Time Capsule Docker is stopped. Macau `20261119000708` remains absent. Live database types still match `8cf3a2a` exactly on main.


## Previous resume — #172 live; rack notice language stop

Reviewed #172 at `3ab6e62c9b46a8aa9784f605a3d88001794eaff3`. A reproduction using the actual PickSheet loading effect offered both a choice and a price beyond a 50-row first page, requesting cursors null then q49. TypeScript passed; Vitest 256 passed / 9 expected skips; CI `44483501122` passed. Roy's account squash-merged `3dab5cf2575ce236302474495484741023196e55`; the fork author remained on the squash, so identical-tree owner release `8b76ceea20239b5160f003afb2c2fa79cc80b881` followed. Vercel `FCeF6CeyijU9yeEu94DjGVYvLsfu` succeeded. Production https://time-capsule-pi-two.vercel.app serves the fresh web export's exact script paths: `__common-d09a18bcb2cde8f5bdf9734087623503.js` and `entry-3eb38356161f741c3257a8cfab012e2c.js`. No migration or art change. Local squash-ancestry conflicts were resolved only after confirming both conflicted files matched main byte-for-byte before applying #172.

Acceptance completed this resume:

- Real-JWT list returned 50 rows and cursor `c70c914a-fc5c-5bb7-ae7a-a12050ed1ad9`; page 2 contained the disposable choice and price. English at 375 px and Chinese at desktop offered and selected both in tomorrow's Change sheets. Chinese at 375 px displayed both selected prompts and grading. Activity Undo restored the original question and price quest IDs exactly. The Chinese mobile Catch editor saved 3 → 4 with default names; admin Undo restored the original slot. The full 28-day calendar matched its original JSON after cleanup. English desktop calendar picker coverage remains to be completed if the full viewport/language cross-product is required.
- Chinese mobile copies-per-catch saved 3 → 4, displayed 4, and admin Undo restored 3. Browser confirmation handling was intermittent; the restoration used the same real-JWT Undo RPC when the browser confirmation did not complete. No catch odds changed.
- English mobile Mixtape switched finite → unlimited → finite, with displayed states and real audited mutations. It had no owners during the switch. A disposable owner was then given 10 copies; the player-adjustment form saved +1 and displayed Now has 11. Undo restored 10 before deleting that fixture. Chinese cards displayed finite/unlimited and adjustment controls; no existing owner balance changed.
- A disposable rack capsule was listed at Civic Square. Chinese mobile Remove with a reason succeeded and displayed 已移除. English mobile showed Removed and the English dates/labels. Admin Undo restored the capsule to waiting before deletion.

**Stop: rack moderation success notice retains the previous language.** Reproduce at 375 px: in Chinese, remove a disposable rack capsule; switch to English without leaving the card. The card correctly changes to Rack / Removed / Opens, but its success message remains `已移除，可以到「紀錄」復原。` instead of English. This is a client presentation issue; the removal itself succeeded. `mobile/src/features/admin/RackCard.tsx:50–54` stores an already translated `h.removed` string in state, and line 73 renders `note.text` after language changes. Claude should store a success/error code or translate at render time, and check the same pattern in nearby admin notices. Test zh → en and en → zh while success/error feedback remains visible. No screen fix was made by Codex.

Per Roy's stop-on-failure instruction, remaining City Hunt/five-type acceptance (including third price miss = 0) and outstanding viewport/language checks are held. Memory Route was already complete. Do not mark the entire release Done yet or merge the status docs as completion.

Cleanup: all three tomorrow slots restored via Undo; the full original 28-day calendar matched exactly. The calendar auto-filled November 29 using the published fixture; its three newly created schedule/rule rows were removed, restoring that originally unavailable day. All fixture pool/rule rows were removed and the pool returned to 220. Copies per catch is 3; Mixtape is finite. The rack capsule was restored then deleted. Both temporary accounts were globally signed out, and users/profiles/identities/sessions/refresh tokens/Auth audit records, fixture ownership/capsule, membership and 18 admin actions/secrets were removed. Verified fixture counts are zero; the append-only audit trigger is enabled. Browser signed out and viewport reset; credential helper files removed. No Time Capsule Docker containers are running. Macau `20261119000708` remains absent. Live types from `8cf3a2a` still match main.


## Previous resume — #171 live; calendar picker pagination stop

Reviewed PR #171 head `528ea57b326c441115e1fbb397300a97f7a9dfc5`. The actual PoolSheet payload/save reproduction now includes the persisted ID on the second save for both choice and price, omitting unchanged answer/local_amount. TypeScript passed; Vitest 254 passed with 9 expected skips; CI `44480968580` passed. Roy's account squash-merged as `2877d0bae226cd28bb0eaf6c80e52513cad9a043`. Owner-authored identical-tree release `c79b212e92762aa4316e3b274fadca97addfd44a` is live at https://time-capsule-pi-two.vercel.app. Vercel deployment `9U5ZEkCMMKaceiCHbMWPURBEisDg` succeeded; production common/entry bundle hashes match the fresh web export (`__common-b24e7b4af09c8880242fd3db6d590a0d.js`, `entry-a22fe8e95a1edfa923c19f591ea7d90b.js`). No migration or art change.

Production checks with two disposable accounts:

- At 375 px in Chinese, created a choice draft, saved, edited English and saved again without selecting an answer. SQL confirmed exactly one row, edited prompt, original answer 0, and outside_coverage=false. Publish succeeded without crashing.
- At 1280 px in English, created a price draft, saved twice without re-entering its amount. Exactly one row retained local_amount=64 and USD=2.00, with outside_coverage=false.
- Edited the used Q1 Ferris-wheel entry, preserving Used in 1 place and Outside the map. A temporary old checked_on showed Not checked for 6 months; Today + Save removed it. Hide retained the metadata; Activity Undo restored Published. Then its original checked_on was restored through the admin RPC and the full list entry matched the saved original exactly.
- Chinese desktop and English mobile pool views showed the hidden reasons. Calendar swap changed tomorrow's question/price ordering correctly. A typed-answer pool item was refused by the server as expected: Today's Hunt supports choice questions only. This negative check is not the stop.

**Stop: calendar replacement picker silently truncates the published pool at 50 rows.** `mobile/src/features/admin/TodaysHuntCalendar.tsx:125` calls `adminHuntLoop.pool(city, "published")` once and discards `next_cursor`. PickSheet has no Load more control. The disposable published choice `dc508c89-8ae5-4648-8ee2-7763443831dd` was given a location at Civic Square; the backend's `private.todays_hunt_pool('taipei')` confirmed it eligible. The list API returned 50 rows, cursor `c70c914a-fc5c-5bb7-ae7a-a12050ed1ad9`, then six rows on page 2 including this choice. It never appeared in the production Change the question picker, even after closing and reopening it. Consequently the calendar set acceptance could not be completed through the UI. The same one-page load serves price replacements.

Claude follow-up: load subsequent published-pool pages or expose paging in PickSheet, preserving city/type/current-selection handling and cancellation when the sheet closes or changes. Test valid choice and price entries beyond the first 50 mixed rows. No screen fix or backend change was made by Codex. Per Roy's stop instruction, remaining calendar set/catch, copies per catch, unlimited switch, player adjustment, rack moderation and remaining City Hunt/five-type acceptance are held. Memory Route is already complete from the prior release; do not repeat it unnecessarily.

Cleanup: used Q1 row restored exactly; the calendar swap was undone through the admin RPC and tomorrow's full calendar, including original quest IDs, matched its snapshot. Both fixture pool rows and grading rows were deleted. Two Auth accounts, profiles, identities, sessions, refresh tokens, Auth audit records, temporary membership and 13 fixture-admin audit actions/secrets were removed; all checked fixture counts were zero and pool count returned to 220. No fixture quest rule or capsule remained. Append-only audit trigger restored/enabled within the cleanup transaction. Browser signed out and viewport reset; credential helper files removed. No Time Capsule Docker stack is running. Macau `20261119000708` remains absent; live types still match main. Done/status docs stay unmerged pending acceptance.

## Earlier PR #171 review stop — new entry loses its ID in the open form

Reviewed head `c11fc021523054ba48605d4be1d8ee7a4bdecd82`; CI `44479588961` is green and GitHub reports mergeable. The `PoolResult`/`mergePoolEntry` change fixes the missing `uses` shape for the card and open sheet, preserving an existing usage list.

A local deterministic reproduction extracted the actual `PoolSheet` hook initialization, payload construction and save handler from this head. A hook-state harness preserved state across the same mounted component, supplied a server-assigned ID on the first save, then edited the prompt and saved again. The second request still omitted `id` and `answer`. This is a client payload reproduction, not a hosted test. Q1's real server definition confirms the outcome: missing `id` selects the insert path, and a new choice without an answer raises `bad_rule`. If the admin selects an answer again, that same missing ID can create another draft instead of editing the first.

Cause: `PoolSheet` initializes `f` from `entry` only once (`useState` initializer). Saving changes the parent's `entry` prop from null to the returned row, but the sheet remains mounted and `f` retains no ID. The save payload comes from `f`; `setAnswer(undefined)` clears the answer after the first save. This pre-existing form-state issue becomes reachable once #171 prevents the original crash.

Claude follow-up: ensure subsequent saves use the persisted entry ID (or deliberately reinitialize/remount the form on new → saved identity transition). Cover create → save → edit → save without closing the sheet for both choice and price, and assert one row, unchanged identity, and retained answer/amount when those fields are left blank. Re-entering an answer must also update that same row. Keep the usage-preservation tests.

The list also derives `needs_recheck`, which mutation rows omit; `PoolResult` still declares it required and the new merge retains the old value after changing `checked_on`. Align that shape and refresh/recompute the indicator when its source changes so the sample does not mask this difference.

Per Roy's stop-on-failure instruction, #171 was not merged or deployed. No production test, fixture, database mutation, migration, art or screen change was made on this resume. Main remains `e80d0a7`; the previous zero-fixture cleanup and completed Memory Route checks remain valid. Admin acceptance, remaining City Hunt checks and Done/status-doc merge remain pending. Macau remains outside this task.

## Previous production resume — Memory Route passed; admin save crash

PR #170 head `3533590ee4e1fff328bb8a9ff4f41494ad44fc36` passed review, TypeScript, 249 tests (9 sample-only skips), CI `44474755813`, and a fresh web export. The delayed-response reproduction using the actual RouteBuilder functions kept Catch at the home place. Roy's account squash-merged #170 as `6753dc0e0035267afd1f9d3b7846bdf0444e2232`; the identical tree was released in owner-authored `e80d0a7b994212c8b8af673176b7c158cb8cbb63`. Vercel deployment `F2k6RysxYuh6oMa1tKVYPhNTVMNm` reports success. Production common/entry bundle hashes match the export (`__common-894f4221433d8188254e1e49c0d0b2c0.js`, `entry-c2e68e6cf3439d65dbad704b7894d472.js`). This is the current live version at https://time-capsule-pi-two.vercel.app.

Production at 375 × 812, with disposable accounts:

- Memory Route in English: hand-picked Civic Square-area home → Question stayed home → City questions moved to Rainbow Starting Line → Write my own restored home. Catch, Landmark and Arrive also restored/kept home. Sent a personal Question route to Future me, answered at the original location, observed 1/1 completion and held to open the exact test letter.
- Traditional Chinese repeated the editor flow and sent an Arrive Memory Route, completed it and opened its Chinese test letter. A browser-only 3-second delay on `route_pool_pick` reproduced Price → Catch; after the delayed reply the stop remained Catch at the original home. The delay wrapper was removed. Walking used simulated coordinates; only the two disposable capsule opening times were advanced.
- Chinese City Hunt: joined Taipei and agreed with the Keeper, observed five blue numbered pins and sequential locks. Completed the first Arrive; its done state and the next unlocked pin were verified. English Keeper/pin acceptance was already recorded in the prior resume. Full five-type completion remains pending. The temporary player's speed allowance was removed during cleanup.
- Admin question-pool cards displayed the outside-map pill in Chinese. Adding a new choice question through the production UI succeeded as a draft with `outside_coverage=false`, but crashed the page immediately afterward.

**Stop: admin pool save response is not a complete PoolEntry.** Browser error: `TypeError: Cannot read properties of undefined (reading 'length')`, in `QuestionPool` (production `hunts-65a052db35ec1e4263446928c1066869.js`). Reproduce: `/admin/hunts` → Taipei → Add → enter bilingual place/prompt/two choices, select the answer → Save. The draft persists, but the app becomes blank. Location may be left empty for a draft; this is unrelated to the failure.

`mobile/src/features/admin/QuestionPool.tsx:41–43` inserts the mutation response directly into the list, and line 61 reads `e.uses.length`. The list RPC adds `uses` and derived metadata; `admin_question_pool_save` returns `to_jsonb(saved)` without `uses` (Q1 line 86). The service incorrectly types both shapes as `PoolEntry`. Status mutation also returns a plain row. Claude should reconcile mutation responses with the list shape (for example, reload the authoritative list after mutations), preserve accurate usage/derived metadata for edits, and test save/edit/status with the real response shape. Do not merely fabricate an empty usage list for an existing used question. No screen or migration body was changed by Codex.

Per Roy's stop instruction, no further acceptance actions were attempted. Pending: admin price draft, publish/edit/Undo (including Q1 outside-coverage preservation), hidden-reason/bilingual checks, copies settings, player adjustment, rack moderation, calendar, and remaining five-type City Hunt checks including third price miss = 0. Done/status-doc merge stays held.

Cleanup verified: zero temporary Auth users/identities/sessions/refresh tokens/audit entries, profiles, capsules and route stops, ownership/game/hunt/located-progress rows, admin memberships/actions/secrets and speed allowances. The single draft was deleted; pool count returned to 220. Its one audit action was removed in a transaction with the append-only trigger restored and verified enabled. No existing pool row, calendar, vessel, game setting or production odds was edited. Browser signed out; viewport reset; full navigation cleared simulated GPS; credential-bearing helper files removed. Time Capsule Docker remains stopped. Macau `20261119000708` remains absent; no migration ran. Live types still match main.

## Prior resume history

Rack follow-up release `dde7aaf7118b0a153d7868bbfc84d4e226971736` is live at https://time-capsule-pi-two.vercel.app. Vercel reports success for deployment `Aqtq8FMsK3M6GXDerNEts5zrXGzR`; its production entry and common JavaScript bundle hashes match the verified web export (`entry-5c9d685f64a97ed6829e861fd60a4cf3.js`, `__common-600764e1d077e9d748f72cf9bcd29e2e.js`). PR #169 merged through Roy's account as `c3e25f5`; GitHub retained the fork author on that squash, so the identical tree was released in Roy-authored `dde7aaf`. The initial combined release was `62b1028`. Approved art and migration bodies are unchanged.

## Merges and verification

| PR | Squash | Deployment |
| --- | --- | --- |
| #157 | `2fa8151` | held |
| #158 | `05bb0b6` | held |
| #163 | `7bdb6d7` | held |
| #165 | `fb0b13a` | held |
| #167 | `cec8fa2` | held |
| #168 | `62b1028` | initial combined release |
| #169 | `c3e25f5` | rack filters/paging; owner release `dde7aaf` |

#165 and #167 needed the authorized ancestry refresh after the preceding squash. Every file touched by the preceding squash matched its PR head; branch-side conflict resolutions preserved both complete trees byte-for-byte. Local tsc/Vitest passed, then CI passed on refreshed heads `b1e802f` (238 pass / 1 skip) and `2d8faf0` (248 pass / 1 skip).

Release tree `961067e` exactly matched tested `4523a49`. Six backend switches are true, including admin hunt-loop; existing `ADMIN_BACKEND` remains true. TypeScript passed, Vitest passed 240 with 9 expected sample-only skips, Expo dependencies were aligned, and web/iOS exports passed. CI 44460665508 passed. Live type generation changed only conditional-type helper parentheses and the ending newline; owner commit `8cf3a2a` passed TypeScript and CI 44461633235 before the final squash.

The previously completed full hosted rollback and local real-JWT checks remain valid: no migration or application behavior changed on this resume. Claude approved Q1 fix `9300527`; seed JSON remains byte-identical. Route test determinism changes are test-only.

## Applied database versions

The hosted CLI dry-run listed exactly these eight migrations, and the hosted CLI push applied them in this order:

1. `20261118123808` — vessel copies
2. `20261118124925` — hunt racks
3. `20261118125002` — question pool
4. `20261118125330` — shared quests
5. `20261118130332` — City Hunt quest locations
6. `20261118134846` — Today's Hunt
7. `20261118135059` — route capsules
8. `20261118141225` — Q1 pool data and approved admin-save fix

The scoped migration directory copied all repository migrations except Macau `20261119000708`; every copied body matched the release branch. Commands used `supabase db push --remote=uzimuygyxwraybsipeij --include-all --skip-vault`, first with `--dry-run`, then with `--yes`. Singapore `20261118140304` was already applied and was not reapplied. Macau remains unapplied.

Immediately before cutover, rack inventory still showed 14 move, 4 delete and 1 keep. After application there were 15 public capsules. The live pool has 55 rows per city (220 total); the approved Q1 admin-save line is present.

## Production checks and current stop

The earlier `photo-strip` Shop assertion is a passing negative check (`collect_only`). The subsequent Maison check passed purchase at 10 copies, one send leaving 9, and retention at ×0 in Cabinet/Album with Create and the send RPC refusing it. Cabinet/Album/Create were checked at 375 px in zh/en. Those fixtures were cleaned before this resume.

PR #169 at `86f1421bd535623d26a202c27fa53ca6536f8b5c` resolved the prior missing-filter and page-boundary stops. CI `44467523999` succeeded. Local `npm exec -- tsc --noEmit`, `npm exec -- vitest run` (244 passed, 9 expected skips) and `npx expo export --platform web --output-dir /tmp/tc-hl-rack-export` passed. The mobile tree matched main after squash; live types still match `8cf3a2a` exactly.

Four fresh disposable accounts used real hosted GoTrue JWTs. Production browser checks used 375 × 812 and simulated location, not a physical walk:

- **Racks:** all six chips in zh/en matched API counts and contents. Before claiming: All 29, Ready 28, Waiting 1, Question 26, Friends 26, Mine 0. Question loaded 24 items, then 2; browser navigation passed 24 → 25 → 26 → 1, with Back from the first staying put before all pages loaded. English repeated the boundary after a claim (24 → 25 of 25). Mine kept the empty rack card open. Create sealed one question-locked and one unlocked public capsule. A wrong answer was refused; the correct answer displayed the letter, assigned the first reader, and a second reader got `taken`.
- **Today's Hunt:** each city displayed three quest pins. Taipei completed question, price and all three catches for 30 points; Hong Kong, Macau and Singapore exercised incomplete-catch completion for 22 points. All paid the once-only 3 wax balls, ending at 42 from 30. Completed pins displayed purple with ticks. Speed up showed ×4; Macau and Singapore ran with emulated Reduce Motion. All four completed summaries were checked in zh/en. Taipei's friends board showed the player at 30 and the disposable friend at 10.
- **City Hunt:** joined Taipei, met the Keeper and selected Let's go. The 60-minute timer began and five blue numbered pins appeared (three Arrive, Catch, Landmark). The remaining pins were locked in sequence. This English check passed; the full bilingual five-type City Hunt checklist remains incomplete.
- **Friend route:** sent through the real RPC from the disposable friend, received its one brass Arrive stop, completed it through the production map, observed the checklist change to 1 of 1, and held to open the letter. Only this fixture's opening time was advanced for the test.

**Current stop: Memory Route loses the user's selected place when adding their own question.** Reproduction at 375 px in English:

1. Create → Future me → Walk a route → Tap your own places on the map.
2. Use the selected Civic Square-area spot, labelled `府前停車場 (行人出口)`. It starts as Arrive.
3. Choose Question. The stop changes to `Rainbow Starting Line` and its pool question.
4. Choose Write my own. The free-text question fields appear, but the replacement place remains.

`mobile/src/features/create/RouteBuilder.tsx:59` automatically calls the pool picker on a change to Question. Line 50 overwrites the chosen coordinates and both names with the pool location. Lines 105–107 switch to a personal question without restoring the chosen place. There is no control to reposition that existing stop. This prevents the own-place/own-question Memory Route described in `docs/design/hunt-loop.md:59` and `:61`. Claude should preserve the manually selected place for a personal question and make a move to a pool location explicit. No screen fix was made by Codex, and the Memory Route draft was not sent.

Stop-on-failure was honored. Pending: repaired Memory Route send/walk/open, remaining bilingual City Hunt/five-type checks (including third price miss = 0 points), and the full production admin checklist (pool create/publish/edit/Undo, outside-map/hidden metadata, copies settings, player adjustment, rack moderation and calendar). HL-U1–U5, HL-C1–C5 and HL-Q1 are not marked Done, and the status docs remain unmerged. No migration was reapplied; Macau remains excluded.

## Earlier stops (resolved)

The missing rack controls were recorded in `9f6186c`, and the old modulo page-boundary bug in `54e4feb`. Both are fixed and production-verified by #169. The initial Shop-fixture correction was recorded in `02ceed3`.

## PR #170 review stop

Reviewed head `c887608735f0f8de9de84657c89cdc7bd7fb24fc`; CI `44472236346` passed. The new home-place helpers address the normal sequential Memory Route flow, and `stopForSend` excludes the editor-only home field.

A delayed-response reproduction using the PR's actual `homePlace`, `retypeStop`, `update`, `another` and `retype` functions found a remaining race: from a hand-placed Arrive stop, choose Price (pool request pending), then Catch. Catch correctly restores the home place, but when the older pool request resolves, `another` unconditionally calls `update` and changes the stop back to Price at the pool location. Type chips remain available during that request. This async path predates the PR, but still defeats the required place restoration under normal network latency.

Claude follow-up: track and invalidate pending requests per stop on subsequent type/place/source changes or removal; only a response for the current intent may update the stop. Add a delayed-response regression covering Price → Catch (and a pool request superseded by a personal question). The four helper tests do not cover the asynchronous component path.

Per Roy's stop instruction, #170 remains unmerged. No production changes, fixtures or browser tests were performed on this resume. The prior cleanup remains intact. Memory Route production checks, remaining City Hunt/admin acceptance and Done/status-doc merge are still pending. Macau was untouched.

## Cleanup

All four accounts were globally signed out and deleted, along with their temporary admin membership and 31 disposable capsules. Verified zero fixture users, profiles, Auth identities, sessions, refresh tokens, Auth audit entries, friendships, capsules, ownership rows, daily plays, game-player rows, City Hunt progress, admin memberships and admin actions. Friend-route stops and content were also zero. No custom pool, vessel, calendar edit or game setting was created; calendar reads only initialized legitimate production schedules. No audit-trigger override was needed on this resume.

The unsent Memory Route draft was discarded. Credential-bearing harness/session files were deleted. Browser signed out; viewport and Reduce Motion overrides reset; navigation cleared the simulated geolocation. Time Capsule Docker containers remain stopped, and other projects' containers were untouched. Macau `20261119000708` was verified absent after cleanup.

Local run command: `cd mobile && npm run web`, at http://localhost:8088.
