#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building physio-vnet..."
cd "$SCRIPT_DIR/physio/vnet" && ./build.sh

echo "Building physio..."
cd "$SCRIPT_DIR/physio/main" && ./build.sh

echo "Building physio-web..."
cd "$SCRIPT_DIR/physio/ui" && ./build.sh

echo "All images built and pushed successfully."
