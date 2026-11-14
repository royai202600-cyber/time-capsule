begin;

alter table public.hunt_waypoints
  drop constraint hunt_waypoints_image_reference,
  add constraint hunt_waypoints_image_reference check (
    image in ('tpl:park', 'tpl:garden', 'tpl:waterfront', 'tpl:square', 'tpl:publicArt', 'tpl:oldStreet')
    or (
      split_part(image, '/', 1) = hunt_id
      and substr(image, char_length(hunt_id) + 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]jpg$'
    )
  );

commit;
