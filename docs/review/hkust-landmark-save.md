# HKUST Landmark save follow-up

At 1440 px in the signed-in English production admin map, the header Save persisted every edit. Removing buildings left the editor dirty after the refreshed data arrived. The colour-only change cleared the dirty state.

| Edit | HTTP status | Response and Activity ID | Editor after reload |
| --- | --- | --- | --- |
| Change the building colour to Ink blue | 200 | 1856 | Save disabled. Cancel closed the panel. |
| Remove one building, 83 → 82 | 200 | 1858 | Save stayed enabled. Cancel showed Unsaved changes. |
| Remove 75 buildings with map taps, 83 → 8 | 200 | 1860 | Save stayed enabled. Cancel showed Unsaved changes. |

The [captured requests](hkust-landmark-save-requests.json) contain the complete `admin_landmark_set` bodies, response bodies, and matching Supabase API log events. Each log matches the browser’s `sb-request-id`. All three POSTs returned 200. No matching Postgres or PostgREST error was logged.

[LandmarkFields.tsx](../../mobile/src/features/admin/LandmarkFields.tsx#L43) rebuilds the edited building object in the order `ids, real_top, top, color`. The refreshed row returns `ids, top, color, real_top`. The values and array order are identical. [WaypostBuilder.tsx](../../mobile/src/features/admin/WaypostBuilder.tsx#L165) compares the two with `JSON.stringify`, leaving the editor dirty after a successful save. Claude can compare the settings structurally or reset from the saved settings in the screen.

Roy confirmed that Save in the close prompt saves and closes. [EditSheet.tsx](../../mobile/src/features/admin/EditSheet.tsx#L53) runs the requested close callback after a successful save from that prompt.

Production began at eight buildings. Activity 1831 already contained the original 83-building row and its successful eight-building update. Activity 1855 restored the 83-building baseline before QA. Activity Undo reverted all three tests. The final Undo was 1861, and the entire Waypost row matched Activity 1831’s before snapshot. The test admin wrote to HKUST only. Its account, profile, admin role and sessions were removed and verified at zero. The real Landmark’s Activity entries retain the test and Undo history.
