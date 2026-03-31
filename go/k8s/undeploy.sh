#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Removing physio-web..."
kubectl delete -f "$SCRIPT_DIR/physio-web.yaml" --ignore-not-found

echo "Removing physio..."
kubectl delete -f "$SCRIPT_DIR/physio.yaml" --ignore-not-found

echo "Removing physio-vnet..."
kubectl delete -f "$SCRIPT_DIR/physio-vnet.yaml" --ignore-not-found

echo "Undeployment complete."
