#!/usr/bin/env bash
#
# Snapshot Railway prod data into the local Docker Postgres so you can
# preview the new predictions against real observations. Safe by design:
#   - Only SELECTs against prod (default_transaction_read_only=on).
#   - Writes only to the local DB (localhost:5432 — the Docker container).
#
# Prereqs:
#   - libpq tools on PATH:  brew install libpq && brew link --force libpq
#   - Local DB up:          docker compose up -d db
#
# Usage:
#   ./scripts/snapshot_prod_to_local.sh

set -euo pipefail

PROD_URL="${PROD_URL:-postgresql://postgres:qtffTcqrWMTecFWbtnOjGdRzTlLzknam@yamabiko.proxy.rlwy.net:42856/railway}"
LOCAL_URL="${LOCAL_URL:-postgresql://borderpulse:borderpulse@localhost:5432/borderpulse}"
DUMP_FILE="$(mktemp -t borderpulse_snapshot.XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "→ Verifying local DB is reachable..."
psql "$LOCAL_URL" -c 'select 1' >/dev/null

echo "→ Dumping prod (ports_of_entry, lane_types, wait_time_observations)..."
PGOPTIONS='-c default_transaction_read_only=on' pg_dump \
  --no-owner --no-privileges --data-only \
  --table=ports_of_entry \
  --table=lane_types \
  --table=wait_time_observations \
  "$PROD_URL" > "$DUMP_FILE"

echo "  $(wc -l < "$DUMP_FILE" | tr -d ' ') lines written to $DUMP_FILE"

echo "→ Clearing local observations + reference tables..."
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 <<'SQL'
TRUNCATE wait_time_observations;
TRUNCATE predictions RESTART IDENTITY CASCADE;
TRUNCATE ports_of_entry RESTART IDENTITY CASCADE;
TRUNCATE lane_types RESTART IDENTITY CASCADE;
SQL

echo "→ Restoring snapshot into local..."
psql "$LOCAL_URL" -v ON_ERROR_STOP=1 -f "$DUMP_FILE" >/dev/null

echo "→ Row counts:"
psql "$LOCAL_URL" -c "
  SELECT 'ports'        AS table, count(*) FROM ports_of_entry
  UNION ALL SELECT 'lane_types',    count(*) FROM lane_types
  UNION ALL SELECT 'observations',  count(*) FROM wait_time_observations;
"

echo
echo "✓ Snapshot loaded. Restart the backend so it recomputes predictions:"
echo "    docker compose restart backend"
echo "  Then open http://localhost:3000"
