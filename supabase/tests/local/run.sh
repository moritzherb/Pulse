#!/usr/bin/env bash
# Run the migrations and pgTAP tests against a local Postgres (PostGIS,
# pg_cron and pgTAP installed), without Docker or the Supabase stack.
#
#   PGDATABASE=pulse_test supabase/tests/local/run.sh
#
# Uses a throwaway database. With the Supabase CLI you can instead run
# `supabase test db`, which uses the real auth / realtime schemas.
set -euo pipefail
cd "$(dirname "$0")/../.."   # -> supabase/

DB="${PGDATABASE:-pulse_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")

# --force: the pg_cron launcher keeps a connection open to its database.
dropdb --if-exists --force "$DB" >/dev/null
createdb "$DB"

"${PSQL[@]}" -f tests/local/supabase_stubs.sql
"${PSQL[@]}" -c 'create extension if not exists pgtap with schema extensions'
for f in migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null
done

status=0
for t in tests/database/*.test.sql; do
  out=$(psql -X -d "$DB" -v ON_ERROR_STOP=1 -tA -c 'set search_path = public, extensions' -f "$t" 2>&1) || status=1
  if grep -qE '^not ok|ERROR|Looks like' <<<"$out"; then status=1; fi
  echo "== $t"
  grep -E '^(ok|not ok|#|1\.\.)|ERROR' <<<"$out" || true
done
exit $status
