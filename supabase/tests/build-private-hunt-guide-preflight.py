from pathlib import Path
m=Path('supabase/migrations/20261114134200_private_hunt_guide.sql').read_text().strip()
u=Path('supabase/tests/private-hunt-guide-upgrade.sql').read_text().strip()
t=Path('supabase/tests/private-hunt-guide.sql').read_text().strip()
assert m.startswith('begin;') and m.endswith('commit;') and u.endswith('rollback;') and t.startswith('begin;') and t.endswith('rollback;')
print(u[:-len('rollback;')].replace('-- INSERT GUIDE MIGRATION HERE',m[len('begin;'):-len('commit;')])+t[len('begin;'):])
