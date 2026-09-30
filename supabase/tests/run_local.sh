#!/usr/bin/env bash
# Rebuilds a throwaway database and applies stub + migrations + seed + tests.
# Usage: PGHOST=/tmp PGPORT=5433 supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${DB:-nexora_test}
PSQL="psql -v ON_ERROR_STOP=1 -q -U ${PGUSER:-postgres}"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d postgres -c "do \$\$ begin create role anon nologin; exception when duplicate_object then null; end \$\$" >/dev/null
$PSQL -d $DB -f tests/local_supabase_stub.sql 2>&1 | grep -v 'already exists' || true
for f in migrations/*.sql; do echo "-> $f"; $PSQL -d $DB -f "$f"; done
echo "-> seed.sql"; $PSQL -d $DB -f seed.sql
if [ "${1:-}" != "--no-tests" ]; then
  echo "-> tests"; $PSQL -d $DB -f tests/rls_and_rpc_tests.sql
  echo "-> settlement tests"; $PSQL -d $DB -f tests/settlement_tests.sql
fi
