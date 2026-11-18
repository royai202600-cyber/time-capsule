"""Run against a disposable migrated DB in the existing Time Capsule container."""
import concurrent.futures
import subprocess
import sys
import time

if len(sys.argv) != 2 or sys.argv[1] != "vessel_copies_test":
    raise SystemExit("Usage: python3 supabase/tests/vessel-copies-concurrent.py vessel_copies_test")

USER = "ac000000-0000-4000-8000-000000000006"
MARKER = "vessel_copy_concurrency"
PSQL = ["docker", "exec", "-i", "supabase_db_time-capsule", "psql",
        "-XAtq", "-U", "postgres", "-d", sys.argv[1], "-v", "ON_ERROR_STOP=1"]


def sql(query, check=True):
    return subprocess.run(PSQL + ["-c", query], check=check, text=True, capture_output=True)


sql(f"""
  insert into auth.users(id,email) values ('{USER}','copies-concurrent@example.invalid');
  insert into public.profiles(id,name) values ('{USER}','Copies race') on conflict (id) do nothing;
  insert into public.owned_vessels(user_id,vessel,copies) values ('{USER}','photo-strip',2);
""")
try:
    with subprocess.Popen(PSQL, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                          text=True, bufsize=1) as lock:
        lock.stdin.write(f"""
          begin;
          select copies from public.owned_vessels
            where user_id='{USER}' and vessel='photo-strip' for update;
          \\echo locked
        """)
        lock.stdin.flush()
        assert lock.stdout.readline().strip() == "2"
        assert lock.stdout.readline().strip() == "locked"

        def send(_):
            return sql(f"""set application_name='{MARKER}';
              set role authenticated;
              set request.jwt.claim.sub='{USER}';
              select public.send_capsule(auth.uid(),'photo-strip','test','',now()+interval '1 day');
            """, check=False)

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
            futures = [pool.submit(send, i) for i in range(5)]
            try:
                for _ in range(40):
                    waiting = sql(f"""select count(*) from pg_stat_activity
                      where application_name='{MARKER}' and wait_event_type='Lock'""")
                    if waiting.stdout.strip() == "5":
                        break
                    time.sleep(0.1)
                else:
                    raise AssertionError("Five sends did not reach the row lock together")
            finally:
                lock.stdin.write("commit;\n\\q\n")
                lock.stdin.flush()
            results = [f.result(timeout=10) for f in futures]
        assert sum(r.returncode == 0 for r in results) == 2
        assert sum(r.returncode != 0 and "no_copies" in r.stderr for r in results) == 3

    assert sql(f"""select copies from public.owned_vessels
      where user_id='{USER}' and vessel='photo-strip'""").stdout.strip() == "0"
    assert sql(f"""select count(*) from public.capsules c join public.capsule_contents b on b.capsule_id=c.id
      where c.sender='{USER}'""").stdout.strip() == "2"
    print("PASS: five blocked sends, two sealed capsules, three no_copies, zero balance retained")
finally:
    sql(f"delete from auth.users where id='{USER}'")
