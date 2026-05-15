#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Start postgres (use /bin/sh entrypoint + tail -f /dev/null to keep container alive)
if [ -n "$(docker ps -q -f name=^unsecure-postgres$)" ]; then
  echo "unsecure-postgres container already running, skipping start postgres"
else
  docker rm -f unsecure-postgres 2>/dev/null || true
  sudo mkdir -p /data/postgres && sudo chmod 777 /data /data/postgres 2>/dev/null || true
  docker run -d --name unsecure-postgres -p 5432:5432 -v /data/:/data/ \
    --entrypoint /bin/sh \
    saichler/unsecure-postgres:latest \
    -c "/start-postgres.sh admin admin admin 5432 && tail -f /dev/null"
  sleep 3
fi

cd "$SCRIPT_DIR/demo"


# Get external IP
EXTERNAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')

echo "Starting physio-vnet..."
./vnet_demo &
sleep 2

echo "Starting physio backend (local mode)..."
./physio_demo local &
sleep 5

echo "Starting physio-web..."
./web_demo &
sleep 2

echo "Starting boostapp-sync (15-minute interval)..."
./boostapp_demo &

