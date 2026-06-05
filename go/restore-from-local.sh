#!/usr/bin/env bash
# Restore the local unsecure-postgres container from the local physio-latest.sql
# backup (./backups/physio-latest.sql), then (re)start the demo via start_demo.sh.
# Drops/recreates tables via the dump's --clean --if-exists clauses, so this
# overwrites any local data.
#
# Use restore-from-prod.sh instead if you want to fetch the latest backup from
# prod first. This script does not touch the network.
#
# Env overrides: POSTGRES_CONTAINER, PGUSER, PGPASSWORD, PGDATABASE, BACKUP_FILE
# Flags: -y / --yes          skip confirmation prompt
#        --no-demo           restore only, do not start the demo services
#        --file <path>       use a specific .sql file instead of physio-latest.sql

set -euo pipefail

CONTAINER="${POSTGRES_CONTAINER:-unsecure-postgres}"
DB_USER="${PGUSER:-admin}"
DB_PASS="${PGPASSWORD:-admin}"
DB_NAME="${PGDATABASE:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BACKUPS="$SCRIPT_DIR/backups"
DEMO_DIR="$SCRIPT_DIR/demo"

assume_yes=0
load_demo=1
BACKUP_FILE="${BACKUP_FILE:-$LOCAL_BACKUPS/physio-latest.sql}"

while [ $# -gt 0 ]; do
    case "$1" in
        -y|--yes) assume_yes=1; shift ;;
        --no-demo) load_demo=0; shift ;;
        --file) BACKUP_FILE="$2"; shift 2 ;;
        -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: backup file not found: $BACKUP_FILE" >&2
    echo "Run backup-db.sh first, or restore-from-prod.sh to fetch one." >&2
    exit 1
fi

# Resolve symlink so the user sees which dump they're actually restoring.
RESOLVED="$(readlink -f "$BACKUP_FILE")"
SIZE="$(du -h "$RESOLVED" | cut -f1)"
echo "Restoring from: $RESOLVED ($SIZE)"

if [ "$assume_yes" -ne 1 ]; then
    echo
    echo "About to restore into local container '$CONTAINER' (database '$DB_NAME')."
    echo "This DROPS existing tables in the local DB."
    [ "$load_demo" = 1 ] && echo "After restore, the local demo services will be (re)started."
    read -rp "Proceed? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

# Stop running services so they release DB connections and don't get
# confused by the schema being dropped under them.
for proc in vnet_demo physio_demo web_demo boostapp_demo; do
    pkill -f "(^|/)${proc}( |$)" 2>/dev/null || true
done

# Ensure local postgres is running (mirror run-local.sh setup).
if [ -z "$(docker ps -q -f "name=^${CONTAINER}$" 2>/dev/null)" ]; then
    echo "Local '$CONTAINER' not running, starting it..."
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    sudo mkdir -p /data/postgres
    sudo chmod 777 /data /data/postgres 2>/dev/null || true
    docker run -d --name "$CONTAINER" -p 5432:5432 -v /data/:/data/ \
        --entrypoint /bin/sh \
        saichler/unsecure-postgres:latest \
        -c "/start-postgres.sh $DB_USER $DB_PASS $DB_NAME 5432 && tail -f /dev/null" \
        >/dev/null
    echo "Waiting for postgres to start..."
    sleep 10
fi

echo "Restoring into $CONTAINER..."
# Strip EXTENSION DDL: those statements require the extension owner
# (postgres superuser), which 'admin' is not, and the extensions are already
# loaded in the container so dropping/recreating them is unnecessary.
sed -E '/^(DROP|CREATE|COMMENT ON) EXTENSION/d' "$RESOLVED" \
    | docker exec -i -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
        psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" \
        > /dev/null

echo
echo "Row counts after restore:"
docker exec -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    psql -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" -c "
SELECT
  (SELECT count(*) FROM physioexercise) AS exercises,
  (SELECT count(*) FROM physioclient)   AS clients,
  (SELECT count(*) FROM treatmentplan)  AS plans,
  (SELECT count(*) FROM planexercise)   AS plan_exercises,
  (SELECT count(*) FROM physiotherapist) AS therapists;"

echo "Restore complete from $(basename "$RESOLVED")."

if [ "$load_demo" != 1 ]; then
    exit 0
fi

# Build binaries if the demo/ layout is missing or incomplete.
need_build=0
for bin in vnet_demo physio_demo web_demo boostapp_demo mocks_demo; do
    [ -x "$DEMO_DIR/$bin" ] || need_build=1
done
[ -d "$DEMO_DIR/web" ] || need_build=1

if [ "$need_build" = 1 ]; then
    echo
    echo "Building demo binaries into $DEMO_DIR..."
    mkdir -p "$DEMO_DIR"
    (cd "$SCRIPT_DIR/tests/mocks/cmd"   && go build -o "$DEMO_DIR/mocks_demo" .)
    (cd "$SCRIPT_DIR/physio/vnet"       && go build -o "$DEMO_DIR/vnet_demo" .)
    (cd "$SCRIPT_DIR/physio/main"       && go build -o "$DEMO_DIR/physio_demo" .)
    (cd "$SCRIPT_DIR/physio/ui"         && go build -o "$DEMO_DIR/web_demo" .)
    (cd "$SCRIPT_DIR/physio/boostapp/main" && go build -o "$DEMO_DIR/boostapp_demo" .)
    rm -rf "$DEMO_DIR/web"
    cp -r "$SCRIPT_DIR/physio/ui/web" "$DEMO_DIR/web"
fi

echo
echo "Starting demo services..."
mkdir -p "$SCRIPT_DIR/logs"
cd "$DEMO_DIR"
nohup ./vnet_demo      >> "$SCRIPT_DIR/logs/vnet_demo.log"     2>&1 < /dev/null & disown
sleep 2
nohup ./physio_demo local >> "$SCRIPT_DIR/logs/physio_demo.log" 2>&1 < /dev/null & disown
sleep 5
nohup ./web_demo       >> "$SCRIPT_DIR/logs/web_demo.log"      2>&1 < /dev/null & disown
sleep 2
nohup ./boostapp_demo  >> "$SCRIPT_DIR/logs/boostapp_demo.log" 2>&1 < /dev/null & disown
cd "$SCRIPT_DIR"

EXTERNAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1")
echo
echo "Demo started. Web UI: https://${EXTERNAL_IP}:2774  (admin/admin)"
echo "Logs: $SCRIPT_DIR/logs/"
echo "Stop with: pkill -f 'vnet_demo|physio_demo|web_demo|boostapp_demo'"
