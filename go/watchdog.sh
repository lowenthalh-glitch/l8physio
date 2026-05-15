#!/usr/bin/env bash
# Watchdog for the four demo services in ./demo. Starts any that are not
# running and restarts them if they die. Per-service stdout/stderr go to
# ./logs/<name>.log. This script lives outside ./demo so that run-local.sh
# (which does `rm -rf demo`) does not wipe it out.
#
# Usage:
#   ./watchdog.sh           # run in foreground
#   ./watchdog.sh --daemon  # detach and run in background (pid in watchdog.pid)
#   ./watchdog.sh --stop    # stop a running watchdog (does NOT stop services)
#   ./watchdog.sh --status  # print status of services and watchdog

set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$SCRIPT_DIR/demo"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

WATCHDOG_LOG="$LOG_DIR/watchdog.log"
WATCHDOG_PID_FILE="$SCRIPT_DIR/watchdog.pid"
POLL_INTERVAL="${WATCHDOG_INTERVAL:-10}"
LOG_MAX_BYTES="${WATCHDOG_LOG_MAX_BYTES:-52428800}"  # 50MB per file

# Ordered list of services: "name|command|post-start-sleep"
# Order matters at cold start: vnet -> physio -> web -> boostapp.
SERVICES=(
  "vnet_demo|./vnet_demo|2"
  "physio_demo|./physio_demo local|5"
  "web_demo|./web_demo|2"
  "boostapp_demo|./boostapp_demo|0"
)

log() {
  printf '%s [watchdog] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"$WATCHDOG_LOG"
}

# Rotate a single log: if over LOG_MAX_BYTES, gzip a copy to <file>.1.gz
# (overwriting any prior .1.gz) and truncate the original in place. We use
# truncate rather than rename so existing service file descriptors (opened
# with >> / O_APPEND) keep writing to the same inode without disruption.
rotate_log() {
  local f="$1"
  [ -f "$f" ] || return 0
  local size
  size=$(stat -c '%s' "$f" 2>/dev/null || echo 0)
  if [ "$size" -gt "$LOG_MAX_BYTES" ]; then
    if gzip -c < "$f" > "${f}.1.gz.tmp" 2>>"$WATCHDOG_LOG"; then
      mv "${f}.1.gz.tmp" "${f}.1.gz"
      : > "$f"
      # Avoid recursing into rotate via log(); write directly.
      printf '%s [watchdog] rotated %s (was %s bytes) -> %s.1.gz\n' \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$(basename "$f")" "$size" "$(basename "$f")" \
        >>"$WATCHDOG_LOG"
    else
      rm -f "${f}.1.gz.tmp"
      printf '%s [watchdog] WARN: gzip failed for %s\n' \
        "$(date '+%Y-%m-%d %H:%M:%S')" "$(basename "$f")" >>"$WATCHDOG_LOG"
    fi
  fi
}

rotate_all_logs() {
  local entry name
  for entry in "${SERVICES[@]}"; do
    name="${entry%%|*}"
    rotate_log "$LOG_DIR/${name}.log"
  done
  rotate_log "$WATCHDOG_LOG"
}

is_running() {
  # Match the exact binary invocation, anchored, to avoid matching this script.
  local name="$1"
  pgrep -f "(^|/)${name}( |$)" >/dev/null 2>&1
}

start_service() {
  local name="$1" cmd="$2" post_sleep="$3"
  local logfile="$LOG_DIR/${name}.log"
  if [ ! -x "$DEMO_DIR/${name}" ]; then
    log "WARN: $DEMO_DIR/${name} missing or not executable; skipping (run run-local.sh to build)"
    return 1
  fi
  log "starting ${name} (logs: ${logfile})"
  # nohup + setsid so the child survives this script exiting. cd into demo/
  # so relative assets (web/) resolve as they do under start_demo.sh.
  nohup setsid bash -c "cd '$DEMO_DIR' && exec ${cmd}" >>"$logfile" 2>&1 < /dev/null &
  disown || true
  if [ "$post_sleep" -gt 0 ]; then
    sleep "$post_sleep"
  fi
}

ensure_postgres() {
  if [ -n "$(docker ps -q -f name=^unsecure-postgres$ 2>/dev/null)" ]; then
    return 0
  fi
  log "unsecure-postgres not running, starting it"
  docker rm -f unsecure-postgres >/dev/null 2>&1 || true
  sudo mkdir -p /data/postgres 2>/dev/null || true
  sudo chmod 777 /data /data/postgres 2>/dev/null || true
  docker run -d --name unsecure-postgres -p 5432:5432 -v /data/:/data/ \
    --entrypoint /bin/sh \
    saichler/unsecure-postgres:latest \
    -c "/start-postgres.sh admin admin admin 5432 && tail -f /dev/null" \
    >>"$WATCHDOG_LOG" 2>&1 || log "WARN: failed to start unsecure-postgres"
  sleep 3
}

status() {
  printf 'watchdog: '
  if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE" 2>/dev/null)" 2>/dev/null; then
    printf 'running (pid %s)\n' "$(cat "$WATCHDOG_PID_FILE")"
  else
    printf 'not running\n'
  fi
  for entry in "${SERVICES[@]}"; do
    local name="${entry%%|*}"
    local pid
    pid="$(pgrep -f "(^|/)${name}( |$)" | head -n1)"
    if [ -n "$pid" ]; then
      printf '  %-14s running (pid %s)\n' "$name" "$pid"
    else
      printf '  %-14s NOT running\n' "$name"
    fi
  done
}

stop_watchdog() {
  if [ ! -f "$WATCHDOG_PID_FILE" ]; then
    echo "no watchdog.pid file; nothing to stop"
    return 0
  fi
  local pid
  pid="$(cat "$WATCHDOG_PID_FILE")"
  if kill -0 "$pid" 2>/dev/null; then
    # Daemon ignores INT/TERM by design; use SIGKILL.
    kill -9 "$pid" 2>/dev/null && echo "stopped watchdog pid $pid"
  else
    echo "watchdog pid $pid not alive"
  fi
  rm -f "$WATCHDOG_PID_FILE"
  printf '%s [watchdog] watchdog stopped (pid %s)\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$pid" >>"$WATCHDOG_LOG"
}

run_loop() {
  # In daemon mode (WATCHDOG_DAEMON=1), ignore INT/TERM so transient signals
  # from the launching shell or sandbox cannot tear us down. Use --stop, which
  # uses kill -9 to remove the daemon. In foreground mode, default signal
  # handling applies so Ctrl-C terminates as expected.
  if [ "${WATCHDOG_DAEMON:-0}" = "1" ]; then
    trap '' INT TERM
  fi
  echo $$ > "$WATCHDOG_PID_FILE"
  log "watchdog started (pid $$, interval ${POLL_INTERVAL}s, demo=${DEMO_DIR}, log_max=${LOG_MAX_BYTES}B)"
  while true; do
    # Re-assert pidfile in case something removed it.
    if [ ! -f "$WATCHDOG_PID_FILE" ]; then
      echo $$ > "$WATCHDOG_PID_FILE"
    fi
    rotate_all_logs
    ensure_postgres
    for entry in "${SERVICES[@]}"; do
      local name="${entry%%|*}"
      local rest="${entry#*|}"
      local cmd="${rest%|*}"
      local post_sleep="${rest##*|}"
      if ! is_running "$name"; then
        log "${name} is down"
        start_service "$name" "$cmd" "$post_sleep"
      fi
    done
    sleep "$POLL_INTERVAL"
  done
}

case "${1:-}" in
  --stop)
    stop_watchdog
    ;;
  --status)
    status
    ;;
  --daemon)
    if [ -f "$WATCHDOG_PID_FILE" ] && kill -0 "$(cat "$WATCHDOG_PID_FILE" 2>/dev/null)" 2>/dev/null; then
      echo "watchdog already running (pid $(cat "$WATCHDOG_PID_FILE"))"
      exit 1
    fi
    WATCHDOG_DAEMON=1 nohup setsid bash "$0" >/dev/null 2>&1 < /dev/null &
    disown || true
    sleep 1
    if [ -f "$WATCHDOG_PID_FILE" ]; then
      echo "watchdog started (pid $(cat "$WATCHDOG_PID_FILE"), logs: $WATCHDOG_LOG)"
    else
      echo "watchdog failed to start; see $WATCHDOG_LOG"
      exit 1
    fi
    ;;
  ""|--foreground)
    run_loop
    ;;
  *)
    echo "Usage: $0 [--daemon|--stop|--status|--foreground]" >&2
    exit 2
    ;;
esac
