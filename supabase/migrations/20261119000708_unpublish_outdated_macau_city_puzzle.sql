-- Preserve the question and historical plays while retiring the outdated fare.
update public.city_puzzle_questions
set published = false
where city = 'macau'
  and seq = 15;
