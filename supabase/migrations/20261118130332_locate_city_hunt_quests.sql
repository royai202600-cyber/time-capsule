-- Proposed walking routes. Resolve against existing Waypost source references
-- so a reproducible database and production use their own row IDs.
do $$
declare seed record;
declare hunt public.hunts;
declare post public.public_capsule_spots;
declare quest uuid;
declare stored_type private.quest_type;
begin
  for seed in
    select * from (values
      ('xinyi-2026-11',1,'spin',1,'osm:node/12396028030'),
      ('xinyi-2026-11',2,'spin',2,'osm:way/233666147'),
      ('xinyi-2026-11',3,'spin',3,'osm:relation/18367478'),
      ('xinyi-2026-11',4,'restore',5,'osm:way/1341042550'),
      ('xinyi-2026-11',5,'landmark',1,null),
      ('senado-square-2026-11',1,'spin',1,'osm:way/244524327'),
      ('senado-square-2026-11',2,'spin',2,'osm:way/192182416'),
      ('senado-square-2026-11',3,'spin',3,'osm:way/183840226'),
      ('senado-square-2026-11',4,'restore',5,'osm:way/488185729'),
      ('senado-square-2026-11',5,'landmark',1,null),
      ('hkust-2026-11',1,'spin',1,'osm:way/236145960@20m;hkust-outdoor'),
      ('hkust-2026-11',2,'spin',2,'osm:way/240091530@30m;hkust-outdoor'),
      ('hkust-2026-11',3,'spin',3,'osm:way/235913807@40m;hkust-outdoor'),
      ('hkust-2026-11',4,'restore',5,'osm:way/235913807@90m;hkust-outdoor'),
      ('hkust-2026-11',5,'landmark',1,null)
    ) as routes(hunt_id,ordinal,legacy_type,legacy_goal,source_ref)
  loop
    select * into strict hunt from public.hunts where kind='system' and id=seed.hunt_id;
    select * into strict post from public.public_capsule_spots
    where game_enabled and hidden_at is null
      and (case when seed.legacy_type='landmark' then id=hunt.landmark and kind='landmark'
                else source_ref=seed.source_ref and kind='common' end)
      and public.distance_m(lat,lng,hunt.area_lat,hunt.area_lng)<=hunt.area_radius_m
      and (seed.ordinal<>1 or public.distance_m(lat,lng,hunt.keeper_lat,hunt.keeper_lng)>=200);
    stored_type:=case seed.legacy_type when 'spin' then 'arrive' when 'restore' then 'catch' else 'landmark' end;
    insert into private.quest_rules(type,location_lat,location_lng,name_zh,name_en,catch_count,landmark_id)
    values(stored_type,post.lat,post.lng,post.name_zh,post.name_en,
      case when stored_type='catch' then seed.legacy_goal end,case when stored_type='landmark' then post.id end)
    returning id into quest;
    insert into private.city_hunt_located_quests(hunt_id,quest_id,ordinal,legacy_type,legacy_goal)
    values(hunt.id,quest,seed.ordinal,seed.legacy_type,seed.legacy_goal);
  end loop;
end $$;
