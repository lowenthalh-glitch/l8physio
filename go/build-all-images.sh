#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

MAX_RETRIES=3
STALL_TIMEOUT=60
POLL_INTERVAL=5

build_with_stall_guard() {
    local dir="$1"
    local label="$2"
    local logfile
    logfile=$(mktemp)

    for attempt in $(seq 1 $MAX_RETRIES); do
        echo "=== Building $label (attempt $attempt/$MAX_RETRIES) ==="

        cd "$dir"
        ./build.sh > "$logfile" 2>&1 &
        local pid=$!

        tail -f "$logfile" &
        local tail_pid=$!

        local last_size=-1
        local stall_seconds=0
        local stalled=false

        while kill -0 "$pid" 2>/dev/null; do
            sleep $POLL_INTERVAL
            local cur_size
            cur_size=$(stat -c%s "$logfile" 2>/dev/null || echo 0)
            if [ "$cur_size" -eq "$last_size" ]; then
                stall_seconds=$((stall_seconds + POLL_INTERVAL))
                if [ "$stall_seconds" -ge "$STALL_TIMEOUT" ]; then
                    echo ""
                    echo "WARNING: $label stalled for ${STALL_TIMEOUT}s, killing build..."
                    kill "$pid" 2>/dev/null
                    wait "$pid" 2>/dev/null || true
                    stalled=true
                    break
                fi
            else
                stall_seconds=0
                last_size=$cur_size
            fi
        done

        kill "$tail_pid" 2>/dev/null
        wait "$tail_pid" 2>/dev/null || true

        if [ "$stalled" = true ]; then
            rm -f "$logfile"
            logfile=$(mktemp)
            echo "Retrying $label..."
            continue
        fi

        wait "$pid"
        local exit_code=$?
        rm -f "$logfile"

        if [ $exit_code -eq 0 ]; then
            echo "=== $label built successfully ==="
            return 0
        fi

        echo "ERROR: $label failed with exit code $exit_code"
        if [ $attempt -lt $MAX_RETRIES ]; then
            logfile=$(mktemp)
            echo "Retrying $label..."
        fi
    done

    rm -f "$logfile"
    echo "ERROR: $label failed after $MAX_RETRIES attempts"
    return 1
}

build_with_stall_guard "$SCRIPT_DIR/physio/log-vnet"          "physio-log-vnet"
build_with_stall_guard "$SCRIPT_DIR/physio/log-agent"         "physio-log-agent"
build_with_stall_guard "$SCRIPT_DIR/physio/vnet"              "physio-vnet"
build_with_stall_guard "$SCRIPT_DIR/physio/main"              "physio"
build_with_stall_guard "$SCRIPT_DIR/physio/ui"                "physio-web"
build_with_stall_guard "$SCRIPT_DIR/physio/boostapp/main"     "physio-boostapp"
build_with_stall_guard "$SCRIPT_DIR/physio/boostapp/collector" "physio-boostapp-collector"
build_with_stall_guard "$SCRIPT_DIR/physio/boostapp/parser"   "physio-boostapp-parser"

echo "All images built and pushed successfully."
