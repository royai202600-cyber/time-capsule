-- HOLD: deploy PR #49 to production and confirm it is live BEFORE db push.
-- The old production renderer cannot display these ids. Roy approved this order.
-- Batch 1 catalogue only: prices are displayed; acquisition stays free while testing.
-- No brand or limited editions. Existing catalogue rows and RPCs are unchanged.
begin;

insert into public.vessels (id, price_mop, edition_total, brand, sort) values
  ('mixtape',        18, null, null,  8),
  ('instant-camera', 22, null, null,  9),
  ('ramen',          12, null, null, 10),
  ('fortune-cookie',  0, null, null, 11),
  ('red-packet',      0, null, null, 12),
  ('snow-globe',     28, null, null, 13),
  ('phone-booth',    22, null, null, 14),
  ('firefly-jar',    20, null, null, 15),
  ('hourglass',       0, null, null, 16),
  ('gashapon',        0, null, null, 17);

commit;
