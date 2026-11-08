-- RELEASE GATE: deploy and confirm the new app at production BEFORE db push.
-- Acquisition remains free during testing; no editions, brands or earned rewards.
begin;
insert into public.vessels (id, price_mop, edition_total, brand, sort, earned_place) values
  ('hot-air-balloon', 22, null, null, 48, null),
  ('bubble-tea', 12, null, null, 49, null),
  ('dim-sum-steamer', 16, null, null, 50, null),
  ('bento', 18, null, null, 51, null),
  ('paper-cranes', 18, null, null, 52, null),
  ('heart-locket', 22, null, null, 53, null),
  ('suitcase', 20, null, null, 54, null),
  ('postbox', 16, null, null, 55, null),
  ('camp-lantern', 18, null, null, 56, null),
  ('treasure-chest', 24, null, null, 57, null),
  ('spellbook', 24, null, null, 58, null),
  ('escape-pod', 26, null, null, 59, null),
  ('crystal-ball', 22, null, null, 60, null),
  ('wishing-lamp', 22, null, null, 61, null),
  ('potion', 16, null, null, 62, null),
  ('pocket-watch', 26, null, null, 63, null),
  ('diploma-tube', 18, null, null, 64, null),
  ('baby-shoes', 18, null, null, 65, null),
  ('memorial-candle', 0, null, null, 66, null),
  ('rocket-tin', 20, null, null, 67, null);
commit;
