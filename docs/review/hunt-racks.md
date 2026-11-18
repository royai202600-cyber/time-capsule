# Waypost rack data move review

Read-only hosted snapshot, 2026-11-18. No migration has been applied. The inventory may change before release; repeat the query and review the exact disposition immediately before applying. Distances are to the nearest currently game-enabled common Waypost; ties use Waypost ID.

Snapshot: 15 moved, 4 deleted. One moved capsule is already claimed; moving its location must not return it to the rack. Three unclaimed capsules currently use other vessels and need conversion to the public bottle.

This is a proposed disposition, not a record of completed changes. The four deletions include their sealed content. The existing report and moderation functions can reset a claimed public capsule's recipient; they must be changed along with the rack opening path so a report or moderation decision cannot silently put a claimed capsule back in circulation. The old public-nearby, drop, pickup and return RPCs and their legacy wrappers also need explicit retirement behavior.

Reproduce the snapshot with the query below. The point-type predicates distinguish the three existing location sources; the final distance comparison must use the unrounded value.

```sql
select c.id, c.recipient is not null as claimed, c.vessel,
       n.id as waypost, n.name_en, round(n.distance::numeric, 1) as distance_m,
       case when n.distance <= 1000 then 'move' else 'delete' end as disposition
from public.capsules c
left join private.public_capsule_points s
  on s.id = coalesce(c.public_capsule_spot, c.corrupted_drop_spot, c.public_capsule_drop_place)
  and s.corrupted = (c.corrupted_drop_spot is not null)
  and s.drop_place = (c.public_capsule_drop_place is not null)
left join lateral (
  select w.id, w.name_en, public.distance_m(s.lat, s.lng, w.lat, w.lng) as distance
  from public.public_capsule_spots w
  where w.game_enabled and w.kind = 'common'
  order by public.distance_m(s.lat, s.lng, w.lat, w.lng), w.id
  limit 1
) n on true
where c.is_public
order by disposition, c.id;
```

| Capsule ID | Disposition | Nearest Waypost (ID) | Distance (m) | Existing state / vessel |
|---|---|---|---:|---|
| 250ea8a0-f5ae-44a7-b4af-24f8141d70f0 | delete | Square (e346c227-0647-4b31-99a3-2c6baa5b3bed) | 1718629.3 | unclaimed / bottle |
| 30165305-cf5b-4428-87c8-340ac88fa991 | delete | Dahu Park (7aba1ead-3282-4114-8f01-298b27b8d2c0) | 1478695.7 | unclaimed / bottle |
| 4b9bd4a7-5e35-4f30-ba73-736f6917c15c | delete | Watten Heights Playground (f19a5775-f92c-454b-bf87-e17c1245e54e) | 1428789.8 | unclaimed / bottle |
| 571a08ba-949d-43b6-a3f7-277b269b3b2c | delete | Dahu Park (7aba1ead-3282-4114-8f01-298b27b8d2c0) | 1747802.7 | unclaimed / bottle |
| 04c53bde-a0db-4898-8b19-b3b6912c82e2 | move | The Lawn @ Marina Bay (a8c3458a-5114-4069-bfb4-209d06ca2349) | 0.0 | unclaimed / bottle |
| 19f78c9d-a189-4b4f-af1c-c2fa480f24a6 | move | Taipa Central Park (d443af61-f899-4fd3-8682-d81d018e1e01) | 0.0 | unclaimed / bottle |
| 20303ff0-c28b-4478-9b6d-e4d8605bf86a | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / bottle |
| 2877612a-0c14-4984-9c4f-bfa2bb6eb978 | move | Zhongshan Park (2320d485-96e2-4d48-a50b-40ea857f66d3) | 0.0 | unclaimed / bottle |
| 2e382c01-5665-490e-ade4-1e1a1d1e1266 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / hourglass |
| 38bee92f-8f25-4a64-83ee-57e2d7c064b2 | move | Esplanade Park (ce9e7682-41fc-4c55-840f-3445907c33f7) | 0.0 | unclaimed / bottle |
| 3fa3016e-b155-4869-9154-2e10ad8d7363 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / dome |
| 52a2e946-53b2-4da0-b3d4-0297ebfb8938 | move | 228 Peace Park (172388c5-9d3d-4ac1-af6a-fd94f34b73bb) | 0.0 | unclaimed / bottle |
| 8e5a2810-27a3-450e-a5dc-4c33775b787f | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | claimed / bottle |
| 98eae765-99eb-49fa-840e-52b5bb6ea6e6 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 0.0 | unclaimed / envelope |
| bbdfbeaf-c192-4a8f-9880-d8f008ea3c11 | move | Taipei Civic Square (78f2c6fb-9c81-4521-a70c-c90a78bcd3b8) | 67.7 | unclaimed / bottle |
| cac905d1-7ecc-43ee-ba45-d6e0ef2f9db1 | move | Zhongshan Park (2320d485-96e2-4d48-a50b-40ea857f66d3) | 0.0 | unclaimed / bottle |
| dc41325b-d93a-49a2-80ef-ed077b05c2f2 | move | Xinyi Square (cff0ab16-af6b-4e57-bcde-0d0e9075ce8e) | 0.0 | unclaimed / bottle |
| df4f3d12-9f18-4b47-9e59-ad1be7e7f20f | move | Songshou Square (dfa83121-4233-4e14-8f64-45bfe84b3256) | 0.0 | unclaimed / bottle |
| fa2e095d-ac0d-47a3-9720-92302535dff2 | move | Taipei Civic Square (e736802f-8192-42d8-ae36-58caa815e005) | 31.7 | unclaimed / bottle |

