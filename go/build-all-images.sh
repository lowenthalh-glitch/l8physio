#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Building physio-log-vnet..."
cd "$SCRIPT_DIR/physio/log-vnet" && ./build.sh

echo "Building physio-log-agent..."
cd "$SCRIPT_DIR/physio/log-agent" && ./build.sh

echo "Building physio-vnet..."
cd "$SCRIPT_DIR/physio/vnet" && ./build.sh

echo "Building physio..."
cd "$SCRIPT_DIR/physio/main" && ./build.sh

echo "Building physio-web..."
cd "$SCRIPT_DIR/physio/ui" && ./build.sh

echo "Building physio-boostapp..."
cd "$SCRIPT_DIR/physio/boostapp/main" && ./build.sh

echo "Building physio-boostapp-collector..."
cd "$SCRIPT_DIR/physio/boostapp/collector" && ./build.sh

echo "Building physio-boostapp-parser..."
cd "$SCRIPT_DIR/physio/boostapp/parser" && ./build.sh

echo "All images built and pushed successfully."
