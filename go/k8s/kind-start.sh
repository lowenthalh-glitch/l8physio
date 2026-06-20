#!/usr/bin/env bash
set -e

CLUSTER_NAME="physio"
KIND_CONFIG="kind-cluster.yaml"

# Check if kind is installed
if ! command -v kind &> /dev/null; then
    echo "Installing kind..."
    go install sigs.k8s.io/kind@latest
fi

# Create cluster config
cat > "$KIND_CONFIG" <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    kubeadmConfigPatches:
      - |
        kind: InitConfiguration
        nodeRegistration:
          taints:
            - key: "node-role.kubernetes.io/control-plane"
              effect: "NoSchedule"
  - role: worker
    extraPortMappings:
      - containerPort: 2443
        hostPort: 2443
        protocol: TCP
      - containerPort: 2773
        hostPort: 2773
        protocol: TCP
      - containerPort: 2774
        hostPort: 2774
        protocol: TCP
EOF

echo "Creating KIND cluster '$CLUSTER_NAME'..."
kind create cluster --name "$CLUSTER_NAME" --config "$KIND_CONFIG"

echo "Loading Docker images into KIND cluster..."
IMAGES=(
    "saichler/physio-vnet:latest"
    "saichler/physio:latest"
    "saichler/physio-web:latest"
    "saichler/physio-log-vnet:latest"
    "saichler/physio-log-agent:latest"
    "saichler/physio-boostapp:latest"
)

for img in "${IMAGES[@]}"; do
    echo "  Loading $img..."
    kind load docker-image "$img" --name "$CLUSTER_NAME" 2>/dev/null || echo "  Warning: $img not found locally, skipping"
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "=== Phase 1: Namespace + VNet + Log-VNet ==="
kubectl apply -f "$SCRIPT_DIR/physio-kind.yaml" -l app=physio-vnet 2>/dev/null || true
kubectl apply -f "$SCRIPT_DIR/physio-kind.yaml" -l app=physio-log-vnet 2>/dev/null || true
# Apply namespace first
kubectl apply -f - <<EOF2
apiVersion: v1
kind: Namespace
metadata:
  name: physio
  labels:
    name: physio
EOF2

kubectl apply -f "$SCRIPT_DIR/physio-kind.yaml"

echo "Waiting for vnet rollout..."
kubectl rollout status statefulset/physio-vnet -n physio --timeout=120s || true
kubectl rollout status statefulset/physio-log-vnet -n physio --timeout=120s || true

echo ""
echo "=== Phase 2: Core services ==="
echo "Waiting for core service rollouts..."
for svc in physio physio-web physio-log-agent physio-boostapp; do
    kubectl rollout status statefulset/$svc -n physio --timeout=120s || true
done

echo ""
echo "=== KIND cluster '$CLUSTER_NAME' is ready ==="
echo "  kubectl get pods -n physio"
