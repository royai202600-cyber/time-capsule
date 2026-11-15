# Public capsule drop within 100 m

Roy approved the rule in [PR #142](https://github.com/royai202600-cyber/time-capsule/pull/142).
The drop chooses the nearest eligible stored point. Eligible points are
game-enabled Wayposts, existing public-drop points, and seeded Corrupted
Capsule spots. Temporary QA spots are excluded. The two kinds of source table
have separate foreign keys on the capsule, with exactly one filled. Existing
capsules keep their current reference. Journey gets the chosen coordinates
through the existing nearby RPC, and pickup measures from those same coordinates.

Pass it on uses the same pool and chooses a different location at least 1 km
away, preferring the current city, with a one-day drift. The four RPCs were
rebuilt from the definitions live after Admin phase 1.
[Diff against the live functions](public-drop-100m-live-functions.diff)

## Coverage

The hosted rollback used the production point data and the new eligibility
view. The first two columns use the design's five coordinates per city and
the same five after snapping to the public walkways measured in WC1. The
random sample uses 100 reproducible, uniformly distributed points inside
each city's entire PMTiles rectangle, including water and private land where
present. It measures geographic coverage, with no weighting for where
players walk or go to drop a capsule.

| City | Published sample within 100 m | After walkway snap | Random points within 100 m |
| --- | ---: | ---: | ---: |
| Taipei | 3/5 | 3/5 | 6/100 |
| Hong Kong | 1/5 | 1/5 | 3/100 |
| Singapore | 3/5 | 3/5 | 1/100 |
| Macau | 1/5 | 1/5 | 0/100 |

At the published Taipei Civic Square coordinates, the nearest eligible point
is 6.9 m away. It is shared by the named Waypost and a Corrupted Capsule
spot. The drop uses the named point when both share the same coordinates.

## Verification

Run the migration body and `supabase/tests/public-drop-100m.sql` within a
single rollback transaction. This exercises nearest-point selection, refusal,
safety and accuracy checks, discovery coordinates, pickup at 70 and 150 m,
same-city pass-on, two-report hiding, and admin Remove after opening.

The local Supabase Auth and PostgREST check is
`node supabase/tests/public-drop-100m-api.mjs`. Use the local publishable and
service test keys, as documented at the top of the script. It advances drift
only on its own fixture and removes both temporary accounts.
