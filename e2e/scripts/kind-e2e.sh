#!/usr/bin/env bash
# Build -> (re)create KIND -> load images -> deploy -> run Playwright.
#   ./scripts/kind-e2e.sh up      create cluster, load locally-built images, deploy
#   ./scripts/kind-e2e.sh test    run the full Playwright suite
#   ./scripts/kind-e2e.sh patch <app>...   reload a rebuilt image and restart its pod (fix loop)
#   ./scripts/kind-e2e.sh llm     point the agent at the test LLM (public or LAN address)
#   ./scripts/kind-e2e.sh down    delete cluster
set -euo pipefail

E2E_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$E2E_DIR/.." && pwd)"
CLUSTER="${KIND_CLUSTER:-l8physio-e2e}"
NS="${KIND_NAMESPACE:-physio}"
CTX="kind-${CLUSTER}"

# app label -> image
declare -A IMAGE=(
  [physio-vnet]=saichler/physio-vnet:latest
  [physio]=saichler/physio:latest
  [physio-web]=saichler/physio-web:latest
  [physio-log-vnet]=saichler/physio-log-vnet:latest
  [physio-log-agent]=saichler/physio-log-agent:latest
  [physio-boostapp]=saichler/physio-boostapp:latest
)

case "${1:-}" in
  up)
    "$ROOT/k8s/kind-start.sh"
    ;;
  patch)
    shift
    for app in "$@"; do
      img="${IMAGE[$app]:?unknown app $app}"
      kind load docker-image "$img" --name "$CLUSTER"
      kubectl --context "$CTX" -n "$NS" delete pod "${app}-0"
      kubectl --context "$CTX" -n "$NS" wait --for=condition=Ready "pod/${app}-0" --timeout=120s
    done
    ;;
  test)
    shift
    cd "$E2E_DIR"
    [ -d node_modules ] || npm install
    npx playwright test "$@"
    ;;
  llm)
    "$E2E_DIR/scripts/llm-setup.sh"
    ;;
  down)
    "$ROOT/k8s/kind-stop.sh"
    ;;
  *)
    sed -n '2,8p' "$0"; exit 1 ;;
esac
