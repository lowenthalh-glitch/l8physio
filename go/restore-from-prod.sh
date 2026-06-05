#!/usr/bin/env bash
# Fetch the latest physio DB backup from prod, restore it into the local
# unsecure-postgres container, then (re)start the demo via start_demo.sh.
# Drops/recreates tables via the dump's --clean --if-exists clauses, so
# this overwrites any local data.
#
# Env overrides: PROD_HOST, PROD_USER, PROD_KEY, PROD_DIR,
#                POSTGRES_CONTAINER, PGUSER, PGPASSWORD, PGDATABASE
# Flags: -y / --yes          skip confirmation prompt
#        --no-demo           restore only, do not start the demo services

set -euo pipefail

PROD_HOST="${PROD_HOST:-34.199.207.223}"
PROD_USER="${PROD_USER:-ubuntu}"
PROD_KEY="${PROD_KEY:-$HOME/Shachar_key.pem}"
PROD_DIR="${PROD_DIR:-/home/ubuntu/proj/src/github.com/saichler/l8physio/go}"

CONTAINER="${POSTGRES_CONTAINER:-unsecure-postgres}"
DB_USER="${PGUSER:-admin}"
DB_PASS="${PGPASSWORD:-admin}"
DB_NAME="${PGDATABASE:-admin}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BACKUPS="$SCRIPT_DIR/backups"
DEMO_DIR="$SCRIPT_DIR/demo"
mkdir -p "$LOCAL_BACKUPS"

SSH=(ssh -i "$PROD_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$PROD_USER@$PROD_HOST")
SCP=(scp -i "$PROD_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)

assume_yes=0
load_demo=1
for arg in "$@"; do
    case "$arg" in
        -y|--yes) assume_yes=1 ;;
        --no-demo) load_demo=0 ;;
        -h|--help)
            sed -n '2,12p' "$0"; exit 0 ;;
        *) echo "unknown arg: $arg" >&2; exit 2 ;;
    esac
done

echo "Resolving latest backup on $PROD_HOST..."
REMOTE_LATEST="$("${SSH[@]}" "readlink -f '$PROD_DIR/backups/physio-latest.sql' 2>/dev/null || ls -1t '$PROD_DIR/backups'/physio-*.sql 2>/dev/null | head -n1")"
if [ -z "$REMOTE_LATEST" ]; then
    echo "ERROR: no backup found in $PROD_DIR/backups on prod" >&2
    exit 1
fi
REMOTE_BASENAME="$(basename "$REMOTE_LATEST")"
LOCAL_FILE="$LOCAL_BACKUPS/$REMOTE_BASENAME"
echo "  prod file: $REMOTE_LATEST"

if [ "$assume_yes" -ne 1 ]; then
    echo
    echo "About to restore $REMOTE_BASENAME into local container '$CONTAINER' (database '$DB_NAME')."
    echo "This DROPS existing tables in the local DB."
    [ "$load_demo" = 1 ] && echo "After restore, the local demo services will be (re)started via start_demo.sh."
    read -rp "Proceed? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }
fi

if [ -f "$LOCAL_FILE" ]; then
    echo "Already have $LOCAL_FILE locally, skipping download."
else
    echo "Downloading to $LOCAL_FILE..."
    "${SCP[@]}" "$PROD_USER@$PROD_HOST:$REMOTE_LATEST" "$LOCAL_FILE"
fi
ln -sf "$REMOTE_BASENAME" "$LOCAL_BACKUPS/physio-latest.sql"

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
sed -E '/^(DROP|CREATE|COMMENT ON) EXTENSION/d' "$LOCAL_FILE" \
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

echo "Restore complete from $REMOTE_BASENAME."

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
