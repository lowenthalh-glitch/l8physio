#!/usr/bin/env bash
set -e

CLUSTER_NAME="physio"

echo "Deleting KIND cluster '$CLUSTER_NAME'..."
kind delete cluster --name "$CLUSTER_NAME"

rm -f kind-cluster.yaml

echo "KIND cluster '$CLUSTER_NAME' deleted."
