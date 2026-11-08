#!/usr/bin/env bash
set -e
docker buildx build --no-cache --platform=linux/amd64 -t registry.layer-8.dev:44443/phy/physio-boostapp-collector:latest . --push
