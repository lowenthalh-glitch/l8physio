#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-local}"

case "$MODE" in
    local)     YAML="physio-local.yaml" ;;
    baremetal) YAML="physio-baremetal.yaml" ;;
    gke)       YAML="physio-gke.yaml" ;;
    kind)      YAML="physio-kind.yaml" ;;
    *)
        echo "Usage: $0 [local|baremetal|gke|kind]"
        exit 1
        ;;
esac

echo "Deploying physio ($MODE mode)..."
kubectl apply -f "$SCRIPT_DIR/$YAML"

echo "Deployment complete ($YAML)."
