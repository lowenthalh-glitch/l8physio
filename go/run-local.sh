#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean and fetch dependencies
rm -rf go.sum go.mod vendor
go mod init
GOPROXY=direct GOPRIVATE=github.com go mod tidy
go mod vendor

# Start postgres (use /bin/sh entrypoint + tail -f /dev/null to keep container alive)
#docker rm -f unsecure-postgres 2>/dev/null || true
#sudo mkdir -p /data/postgres && sudo chmod 777 /data /data/postgres 2>/dev/null || true
#docker run -d --name unsecure-postgres -p 5432:5432 -v /data/:/data/ \
#  --entrypoint /bin/sh \
#  saichler/unsecure-postgres:latest \
#  -c "/start-postgres.sh admin admin admin 5432 && tail -f /dev/null"
sleep 10

# Build demo binaries
rm -rf demo && mkdir -p demo

echo "Building mock data generator..."
cd "$SCRIPT_DIR/tests/mocks/cmd" && go build -o "$SCRIPT_DIR/demo/mocks_demo" .

echo "Building physio-vnet..."
cd "$SCRIPT_DIR/physio/vnet" && go build -o "$SCRIPT_DIR/demo/vnet_demo" .

echo "Building physio..."
cd "$SCRIPT_DIR/physio/main" && go build -o "$SCRIPT_DIR/demo/physio_demo" .

echo "Building physio-web..."
cd "$SCRIPT_DIR/physio/ui" && go build -o "$SCRIPT_DIR/demo/web_demo" .

# Copy web assets (l8ui is already vendored inside physio/ui/web/l8ui)
cd "$SCRIPT_DIR"
cp -r "$SCRIPT_DIR/physio/ui/web" "$SCRIPT_DIR/demo/"

cd "$SCRIPT_DIR/demo"

# Generate cleanup script
cat > kill_demo.sh << 'EOF'
#!/usr/bin/env bash
pkill -f vnet_demo 2>/dev/null || true
pkill -f physio_demo 2>/dev/null || true
pkill -f web_demo 2>/dev/null || true
docker rm -f unsecure-postgres 2>/dev/null || true
rm -rf /data/physio
echo "Demo stopped and cleaned up."
EOF
chmod +x kill_demo.sh

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

echo ""
echo "=========================================="
echo " Physio is running!"
echo " Web UI: https://${EXTERNAL_IP}:2774"
echo " Default credentials: admin / admin"
echo "=========================================="
echo ""
echo "Press Enter to upload mock data, or Ctrl+C to exit..."
read -r

echo "Uploading mock data..."
./mocks_demo --address "https://${EXTERNAL_IP}:2774" --user admin --password admin --insecure

echo ""
echo "Mock data uploaded successfully."
echo "Press Enter to stop all services and clean up..."
read -r

./kill_demo.sh
