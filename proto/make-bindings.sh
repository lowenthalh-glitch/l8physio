#!/usr/bin/env bash

set -e

wget https://raw.githubusercontent.com/saichler/l8types/refs/heads/main/proto/api.proto

# We also need erp-common.proto for erp.AuditInfo
wget https://raw.githubusercontent.com/saichler/l8erp/refs/heads/main/proto/erp-common.proto

# Physiotherapy Management
docker run --user "$(id -u):$(id -g)" -e PROTO=physio.proto --mount type=bind,source="$PWD",target=/home/proto/ -i saichler/protoc:latest

rm api.proto
rm erp-common.proto

# Move generated bindings to go/types and clean up
rm -rf ../go/types
mkdir -p ../go/types
mv ./types/* ../go/types/.
rm -rf ./types

rm -rf *.rs

cd ../go
find . -name "*.go" -type f -exec sed -i 's|"./types/l8api"|"github.com/saichler/l8types/go/types/l8api"|g' {} +
find . -name "*.go" -type f -exec sed -i 's|"./types/erp"|"github.com/saichler/l8erp/go/types/erp"|g' {} +
find . -name "*.go" -type f -exec sed -i 's|"./types/physio"|"github.com/saichler/l8physio/go/types/physio"|g' {} +
