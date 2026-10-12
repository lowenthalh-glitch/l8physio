#!/bin/bash
# Full E2E pipeline script for l8physio
# This script builds images, creates KIND cluster, deploys, runs tests, and cleans up

set -e

echo "========================================"
echo "  L8Physio E2E Pipeline"
echo "========================================"

# Variables
CLUSTER_NAME="l8physio-e2e"
PROJECT_DIR="/home/saichler/proj/src/github.com/lowenthalh-glitch/l8physio"
GO_DIR="${PROJECT_DIR}/go"
E2E_DIR="${PROJECT_DIR}/e2e"

# Step 1: Build all images
echo ""
echo "[1/5] Building all Docker images..."
cd "${GO_DIR}"
./build-all-images.sh

# Step 2: Create KIND cluster with extraPortMappings
echo ""
echo "[2/5] Creating KIND cluster with extraPortMappings..."
cd "${PROJECT_DIR}"
kind delete cluster --name "${CLUSTER_NAME}" 2>/dev/null || true
kind create cluster --name "${CLUSTER_NAME}" --config kind-config.yaml

# Wait for cluster to be ready
echo "Waiting for cluster to be ready..."
sleep 10

# Step 3: Deploy l8physio to KIND
echo ""
echo "[3/5] Deploying l8physio to KIND cluster..."
kubectl apply -f go/k8s/physio-kind.yaml -n physio

# Wait for all pods to be ready
echo ""
echo "[4/5] Waiting for all pods to be ready..."
kubectl wait --for=condition=Ready pod -l app=physio-vnet --timeout=120s -n physio
kubectl wait --for=condition=Ready pod -l app=physio --timeout=120s -n physio
kubectl wait --for=condition=Ready pod -l app=physio-web --timeout=120s -n physio
kubectl wait --for=condition=Ready pod -l app=physio-log-vnet --timeout=120s -n physio
kubectl wait --for=condition=Ready pod -l app=physio-log-agent --timeout=120s -n physio
kubectl wait --for=condition=Ready pod -l app=physio-boostapp --timeout=120s -n physio

echo "All pods are ready!"

# Step 5: Run Playwright E2E tests
echo ""
echo "[5/5] Running Playwright E2E tests against KIND cluster..."
cd "${E2E_DIR}"
npx playwright test --base-url=http://localhost:8080 --project=chromium

# Cleanup
echo ""
echo "Cleaning up KIND cluster..."
kind delete cluster --name "${CLUSTER_NAME}"

echo ""
echo "========================================"
echo "  E2E Pipeline Complete!"
echo "========================================"
