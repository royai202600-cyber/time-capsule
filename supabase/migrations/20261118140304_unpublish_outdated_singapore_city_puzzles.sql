-- Keep historical plays intact while removing outdated prices from the daily pool.
update public.city_puzzle_questions
set published = false
where city = 'singapore'
  and seq in (1, 2, 6, 12, 15, 16, 18, 19);
