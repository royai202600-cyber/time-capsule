-- Keep the distance calculation independent of caller-controlled schemas.
alter function public.distance_m(double precision, double precision, double precision, double precision)
  set search_path = '';
