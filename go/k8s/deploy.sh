#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deploying physio-vnet..."
kubectl apply -f "$SCRIPT_DIR/physio-vnet.yaml"

echo "Deploying physio..."
kubectl apply -f "$SCRIPT_DIR/physio.yaml"

echo "Deploying physio-web..."
kubectl apply -f "$SCRIPT_DIR/physio-web.yaml"

echo "Deployment complete."
