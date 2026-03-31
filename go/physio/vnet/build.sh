#!/usr/bin/env bash
set -e
docker build --no-cache --platform=linux/amd64 -t saichler/physio-vnet:latest .
docker push saichler/physio-vnet:latest
