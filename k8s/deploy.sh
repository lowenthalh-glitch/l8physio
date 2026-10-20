#!/usr/bin/env bash
set -e

MODE="${1:-local}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="${SCRIPT_DIR}/physio-${MODE}.yaml"

if [ ! -f "$FILE" ]; then
  echo "Usage: $0 [local|baremetal|gke|kind]"
  echo "  (no physio-${MODE}.yaml found in ${SCRIPT_DIR})"
  exit 1
fi

# Pin the KIND context instead of inheriting the ambient one (kind create
# cluster rewrites the current context). The other modes deploy to the
# caller's context on purpose.
KUBECTL=(kubectl)
if [ "$MODE" = "kind" ]; then
  KUBECTL=(kubectl --context "kind-l8physio-e2e")
fi

echo "Applying physio (${MODE})..."
"${KUBECTL[@]}" apply -f "$FILE"

# wait_for waits for an app's workload, whatever its kind in this mode
# (StatefulSet or Deployment).
wait_for() {
  local workload
  workload=$("${KUBECTL[@]}" -n physio get statefulset,deployment -l "app=$1" -o name | head -1)
  echo "Waiting for $1 (${workload})..."
  "${KUBECTL[@]}" -n physio rollout status "$workload" --timeout="${2:-180s}"
}

# Dependency order: vnet -> logs -> core -> web -> boostapp
wait_for physio-vnet
wait_for physio-log-vnet
wait_for physio-log-agent
wait_for physio
wait_for physio-web
wait_for physio-boostapp

echo "physio deployed (${MODE})."
