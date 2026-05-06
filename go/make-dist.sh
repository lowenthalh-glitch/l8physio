#!/usr/bin/env bash
set -e

echo "Select target platform:"
echo "  1) linux"
echo "  2) darwin (macOS)"
echo "  3) windows"
read -rp "Platform [1-3]: " os_choice

case "$os_choice" in
    1) TARGET_OS="linux" ;;
    2) TARGET_OS="darwin" ;;
    3) TARGET_OS="windows" ;;
    *) echo "ERROR: Invalid choice '$os_choice'"; exit 1 ;;
esac

echo ""
echo "Select target architecture:"
echo "  1) amd64 (x86_64)"
echo "  2) arm64 (Apple Silicon / ARM)"
read -rp "Architecture [1-2]: " arch_choice

case "$arch_choice" in
    1) TARGET_ARCH="amd64" ;;
    2) TARGET_ARCH="arm64" ;;
    *) echo "ERROR: Invalid choice '$arch_choice'"; exit 1 ;;
esac

echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DIST_NAME="l8physio-${TARGET_OS}-${TARGET_ARCH}"
DIST_DIR="$SCRIPT_DIR/dist/$DIST_NAME"
EXE_SUFFIX=""
if [ "$TARGET_OS" = "windows" ]; then
    EXE_SUFFIX=".exe"
fi

echo "=========================================="
echo " Building l8physio distribution"
echo " Target: ${TARGET_OS}/${TARGET_ARCH}"
echo "=========================================="

# Clean previous dist for this target
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/bin"

export GOOS="$TARGET_OS"
export GOARCH="$TARGET_ARCH"
export CGO_ENABLED=0

echo ""
echo "[1/5] Building mock data generator..."
cd "$SCRIPT_DIR/tests/mocks/cmd"
go build -o "$DIST_DIR/bin/mocks_demo${EXE_SUFFIX}" .

echo "[2/5] Building physio-vnet..."
cd "$SCRIPT_DIR/physio/vnet"
go build -o "$DIST_DIR/bin/vnet_demo${EXE_SUFFIX}" .

echo "[3/5] Building physio backend..."
cd "$SCRIPT_DIR/physio/main"
go build -o "$DIST_DIR/bin/physio_demo${EXE_SUFFIX}" .

echo "[4/5] Building physio-web..."
cd "$SCRIPT_DIR/physio/ui"
go build -o "$DIST_DIR/bin/web_demo${EXE_SUFFIX}" .

echo "[5/5] Building boostapp-sync..."
cd "$SCRIPT_DIR/physio/boostapp/main"
go build -o "$DIST_DIR/bin/boostapp_demo${EXE_SUFFIX}" .

cd "$SCRIPT_DIR"

echo ""
echo "Copying web assets..."
cp -r "$SCRIPT_DIR/physio/ui/web" "$DIST_DIR/"

echo "Generating run script..."

if [ "$TARGET_OS" = "windows" ]; then
    # Windows batch script
    cat > "$DIST_DIR/run.bat" << 'WINEOF'
@echo off
setlocal

set SCRIPT_DIR=%~dp0
set BIN_DIR=%SCRIPT_DIR%bin\
set DATA_DIR=%SCRIPT_DIR%data

echo ==========================================
echo  L8Physio - Starting System
echo ==========================================
echo.

REM Start postgres container
echo Starting postgres...
docker rm -f unsecure-postgres 2>nul
if not exist "%DATA_DIR%\postgres" mkdir "%DATA_DIR%\postgres"
docker run -d --name unsecure-postgres -p 5432:5432 -v "%DATA_DIR%":/data/ ^
  --entrypoint /bin/sh ^
  saichler/unsecure-postgres:latest ^
  -c "/start-postgres.sh admin admin admin 5432 && tail -f /dev/null"
echo Waiting for postgres to start...
timeout /t 10 /nobreak >nul

echo Starting physio-vnet...
start /b "" "%BIN_DIR%vnet_demo.exe"
timeout /t 2 /nobreak >nul

echo Starting physio backend...
start /b "" "%BIN_DIR%physio_demo.exe" local
timeout /t 5 /nobreak >nul

echo Starting physio-web...
start /b "" "%BIN_DIR%web_demo.exe"
timeout /t 2 /nobreak >nul

echo.
echo ==========================================
echo  Physio is running!
echo  Web UI: https://localhost:2774
echo  Default credentials: admin / admin
echo ==========================================
echo.
echo Press any key to upload mock data...
pause >nul

echo Uploading mock data...
"%BIN_DIR%mocks_demo.exe" --address "https://localhost:2774" --user admin --password admin --insecure

echo.
echo Mock data uploaded successfully.

echo Starting boostapp-sync (15-minute interval)...
start /b "" "%BIN_DIR%boostapp_demo.exe"
timeout /t 2 /nobreak >nul

echo Press any key to stop all services...
pause >nul

taskkill /f /im vnet_demo.exe 2>nul
taskkill /f /im physio_demo.exe 2>nul
taskkill /f /im web_demo.exe 2>nul
taskkill /f /im boostapp_demo.exe 2>nul
docker rm -f unsecure-postgres 2>nul
echo Demo stopped.
WINEOF

else
    # Unix run script (Linux/macOS)
    cat > "$DIST_DIR/run.sh" << 'UNIXEOF'
#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="$SCRIPT_DIR/bin"
DATA_DIR="$SCRIPT_DIR/data"

cleanup() {
    echo ""
    echo "Stopping services..."
    kill $PID_VNET $PID_PHYSIO $PID_WEB $PID_BOOSTAPP 2>/dev/null || true
    docker rm -f unsecure-postgres 2>/dev/null || true
    echo "Demo stopped."
}
trap cleanup EXIT INT TERM

echo "=========================================="
echo " L8Physio - Starting System"
echo "=========================================="
echo ""

# Detect IP
if [[ "$(uname)" == "Darwin" ]]; then
    EXTERNAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")
else
    EXTERNAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}' || echo "127.0.0.1")
fi

# Start postgres
echo "Starting postgres..."
docker rm -f unsecure-postgres 2>/dev/null || true
mkdir -p "$DATA_DIR/postgres"
docker run -d --name unsecure-postgres -p 5432:5432 -v "$DATA_DIR":/data/ \
  --entrypoint /bin/sh \
  saichler/unsecure-postgres:latest \
  -c "/start-postgres.sh admin admin admin 5432 && tail -f /dev/null"
echo "Waiting for postgres to start..."
sleep 10

echo "Starting physio-vnet..."
"$BIN_DIR/vnet_demo" &
PID_VNET=$!
sleep 2

echo "Starting physio backend (local mode)..."
"$BIN_DIR/physio_demo" local &
PID_PHYSIO=$!
sleep 5

echo "Starting physio-web..."
"$BIN_DIR/web_demo" &
PID_WEB=$!
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
"$BIN_DIR/mocks_demo" --address "https://${EXTERNAL_IP}:2774" --user admin --password admin --insecure

echo ""
echo "Mock data uploaded successfully."

echo "Starting boostapp-sync (15-minute interval)..."
"$BIN_DIR/boostapp_demo" &
PID_BOOSTAPP=$!
sleep 2

echo "Press Enter to stop all services and clean up..."
read -r
UNIXEOF
    chmod +x "$DIST_DIR/run.sh"
fi

# Generate stop script for Unix
if [ "$TARGET_OS" != "windows" ]; then
    cat > "$DIST_DIR/stop.sh" << 'STOPEOF'
#!/usr/bin/env bash
pkill -f vnet_demo 2>/dev/null || true
pkill -f physio_demo 2>/dev/null || true
pkill -f web_demo 2>/dev/null || true
pkill -f boostapp_demo 2>/dev/null || true
docker rm -f unsecure-postgres 2>/dev/null || true
echo "All services stopped."
STOPEOF
    chmod +x "$DIST_DIR/stop.sh"
fi

echo ""
echo "Creating zip archive..."
cd "$SCRIPT_DIR/dist"
rm -f "${DIST_NAME}.zip"
zip -r -q "${DIST_NAME}.zip" "$DIST_NAME"

ZIP_SIZE=$(du -h "${DIST_NAME}.zip" | cut -f1)

echo ""
echo "=========================================="
echo " Distribution built successfully!"
echo " Archive: dist/${DIST_NAME}.zip ($ZIP_SIZE)"
echo " Target:  ${TARGET_OS}/${TARGET_ARCH}"
echo "=========================================="
echo ""
echo "To use:"
echo "  1. Copy the zip to the target machine"
echo "  2. unzip ${DIST_NAME}.zip"
echo "  3. cd ${DIST_NAME}"
if [ "$TARGET_OS" = "windows" ]; then
    echo "  4. run.bat"
else
    echo "  4. ./run.sh"
fi
echo ""
echo "Prerequisites on the target machine:"
echo "  - Docker (for postgres)"
