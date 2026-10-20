#!/usr/bin/env bash
set -e

CLUSTER_NAME="l8physio-e2e"
KIND_CONFIG="kind-cluster.yaml"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v kind &>/dev/null; then
  echo "kind not found — installing..."
  curl -Lo ./kind https://kind.sigs.k8s.io/dl/latest/kind-linux-amd64
  chmod +x ./kind
  sudo mv ./kind /usr/local/bin/kind
fi

if kind get clusters 2>/dev/null | grep -q "^${CLUSTER_NAME}$"; then
  echo "KIND cluster '${CLUSTER_NAME}' already exists. Run ./kind-stop.sh first to recreate it."
  exit 1
fi

echo "Creating KIND cluster '${CLUSTER_NAME}'..."
kind create cluster --name "${CLUSTER_NAME}" --config "${SCRIPT_DIR}/${KIND_CONFIG}"
kubectl --context "kind-${CLUSTER_NAME}" wait --for=condition=Ready nodes --all --timeout=120s

echo "Loading images into KIND..."
IMAGES=(
  saichler/physio-vnet:latest
  saichler/physio:latest
  saichler/physio-web:latest
  saichler/physio-log-vnet:latest
  saichler/physio-log-agent:latest
  saichler/physio-boostapp:latest
)
for img in "${IMAGES[@]}"; do
  if docker image inspect "$img" &>/dev/null; then
    echo "  Loading $img..."
    kind load docker-image "$img" --name "${CLUSTER_NAME}"
  else
    echo "  SKIP $img (not found locally; the cluster will pull it)"
  fi
done

"${SCRIPT_DIR}/deploy.sh" kind

echo ""
echo "l8physio is up in KIND: http://localhost:8088"
echo "Run ./kind-stop.sh to tear it down."
