#!/usr/bin/env bash
# Build linux/amd64 demo binaries, tar them up as a drop-in replacement for
# the prod ./demo directory, and scp the tar to prod. Does NOT touch the
# running prod services -- you upgrade manually after this completes.
#
# Usage:
#   ./package-for-prod.sh [version]
#     version defaults to a UTC timestamp (e.g. 20260526T014500Z).
#     Produces dist/demo-<version>.tar both locally and on prod.
#
# Env overrides: PROD_HOST, PROD_USER, PROD_KEY, PROD_DIR

set -euo pipefail

PROD_HOST="${PROD_HOST:-34.199.207.223}"
PROD_USER="${PROD_USER:-ubuntu}"
PROD_KEY="${PROD_KEY:-$HOME/Shachar_key.pem}"
PROD_DIR="${PROD_DIR:-/home/ubuntu/proj/src/github.com/saichler/l8physio/go}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERSION="${1:-$(date -u +%Y%m%dT%H%M%SZ)}"
DIST_DIR="$SCRIPT_DIR/dist"
STAGE_DIR="$DIST_DIR/stage-$VERSION"
DEMO_STAGE="$STAGE_DIR/demo"
TAR_NAME="demo-${VERSION}.tar"
TAR_PATH="$DIST_DIR/$TAR_NAME"

SCP=(scp -i "$PROD_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15)
SSH=(ssh -i "$PROD_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$PROD_USER@$PROD_HOST")

echo "=========================================="
echo " Building l8physio demo package"
echo " Version: $VERSION"
echo " Target:  linux/amd64"
echo "=========================================="

rm -rf "$STAGE_DIR"
mkdir -p "$DEMO_STAGE"

export GOOS=linux
export GOARCH=amd64
export CGO_ENABLED=1

echo "[1/5] mocks_demo..."
(cd "$SCRIPT_DIR/tests/mocks/cmd"      && go build -o "$DEMO_STAGE/mocks_demo" .)
echo "[2/5] vnet_demo..."
(cd "$SCRIPT_DIR/physio/vnet"          && go build -o "$DEMO_STAGE/vnet_demo" .)
echo "[3/5] physio_demo..."
(cd "$SCRIPT_DIR/physio/main"          && go build -o "$DEMO_STAGE/physio_demo" .)
echo "[4/5] web_demo..."
(cd "$SCRIPT_DIR/physio/ui"            && go build -o "$DEMO_STAGE/web_demo" .)
echo "[5/5] boostapp_demo..."
(cd "$SCRIPT_DIR/physio/boostapp/main" && go build -o "$DEMO_STAGE/boostapp_demo" .)

echo "Copying web assets..."
cp -r "$SCRIPT_DIR/physio/ui/web" "$DEMO_STAGE/web"

# Match the kill_demo.sh that run-local.sh generates inside demo/.
cat > "$DEMO_STAGE/kill_demo.sh" <<'EOF'
#!/usr/bin/env bash
pkill -f vnet_demo 2>/dev/null || true
pkill -f physio_demo 2>/dev/null || true
pkill -f web_demo 2>/dev/null || true
pkill -f boostapp_demo 2>/dev/null || true
docker rm -f unsecure-postgres 2>/dev/null || true
echo "Demo stopped."
EOF
chmod +x "$DEMO_STAGE/kill_demo.sh"

echo "Creating $TAR_NAME..."
mkdir -p "$DIST_DIR"
rm -f "$TAR_PATH"
tar -C "$STAGE_DIR" -cf "$TAR_PATH" demo

SIZE=$(du -h "$TAR_PATH" | cut -f1)
echo "Local archive: $TAR_PATH ($SIZE)"

echo
echo "Uploading to $PROD_USER@$PROD_HOST:$PROD_DIR/$TAR_NAME ..."
"${SCP[@]}" "$TAR_PATH" "$PROD_USER@$PROD_HOST:$PROD_DIR/$TAR_NAME"

REMOTE_SUM=$("${SSH[@]}" "sha256sum '$PROD_DIR/$TAR_NAME' | cut -d' ' -f1")
LOCAL_SUM=$(sha256sum "$TAR_PATH" | cut -d' ' -f1)
if [ "$REMOTE_SUM" != "$LOCAL_SUM" ]; then
    echo "ERROR: sha256 mismatch after upload (local=$LOCAL_SUM remote=$REMOTE_SUM)" >&2
    exit 1
fi
echo "Upload verified (sha256=$LOCAL_SUM)."

rm -rf "$STAGE_DIR"

cat <<EOF

==========================================
 Build uploaded to prod.
==========================================

To upgrade prod:

  ssh -i $PROD_KEY $PROD_USER@$PROD_HOST
  cd $PROD_DIR
  sudo systemctl stop l8physio-watchdog.service
  ./demo/kill_demo.sh 2>/dev/null || true   # belt-and-suspenders, leaves postgres alone after watchdog stops
  mv demo demo.prev.\$(date -u +%Y%m%dT%H%M%SZ)
  tar -xf $TAR_NAME
  sudo systemctl start l8physio-watchdog.service
  ./watchdog.sh --status

Rollback (if needed):
  sudo systemctl stop l8physio-watchdog.service
  rm -rf demo && mv demo.prev.<timestamp> demo
  sudo systemctl start l8physio-watchdog.service
EOF
