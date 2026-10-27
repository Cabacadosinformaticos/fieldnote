#!/usr/bin/env bash
# Fault scenario 1: kill one API replica while both gateways route to the API.
# Expected: Traefik stops routing to the dead replica and the other two answer.
# Docker only auto-restarts a process that crashes on its own; a manual
# `docker kill` is a manual stop, so the script starts the container again after
# measuring the gateway failover. No entry load in this block, so entry loss is
# not measured here (the load generator arrives with a later block).
#
# Usage: bash infra/chaos/fs1-kill-api.sh [api1|api2|api3]

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS1 kill an API container"
TARGET="${1:-api2}"

case "$TARGET" in
  api1|api2|api3) ;;
  *) log "unknown API container: $TARGET"; exit 2 ;;
esac

log "$SCENARIO: target $TARGET"

if ! container_ok "$TARGET"; then
  log "precondition failed: $TARGET is not running"
  exit 2
fi
if ! patroni_ok 3; then
  log "precondition failed: Patroni does not have a leader and a sync standby"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200 before the kill"
  exit 2
fi

log "state before:"
print_cluster_state

TARGET_DOWN=0
restore() {
  if [ "$TARGET_DOWN" -eq 1 ]; then
    log "restoring $TARGET"
    docker start "$TARGET" >/dev/null 2>&1 || true
    TARGET_DOWN=0
  fi
}

log "injecting: docker kill $TARGET"
kill_ms="$(now_ms)"
docker kill "$TARGET" >/dev/null
TARGET_DOWN=1

# Measure how long each gateway needs to be continuously healthy again.
g1_start="$(now_ms)"
if stable_gateway "$GATEWAY1" 3 15; then
  g1_ms=$(( $(now_ms) - g1_start ))
else
  g1_ms=-1
fi

g2_start="$(now_ms)"
if stable_gateway "$GATEWAY2" 3 15; then
  g2_ms=$(( $(now_ms) - g2_start ))
else
  g2_ms=-1
fi

log "restoring $TARGET (docker start; a manual kill is not auto-restarted)"
start_ms="$(now_ms)"
docker start "$TARGET" >/dev/null 2>&1 || true
TARGET_DOWN=0

if wait_until 60 1 container_ok "$TARGET"; then
  container_ms=$(( $(now_ms) - start_ms ))
else
  container_ms=-1
fi

all_apis_ok() {
  local api
  for api in api1 api2 api3; do
    container_ok "$api" || return 1
  done
}

if wait_until 60 1 all_apis_ok; then
  apis_ms=$(( $(now_ms) - kill_ms ))
else
  apis_ms=-1
fi

log "measured:"
log "  gateway 1 healthy again: ${g1_ms} ms (target under $(( TARGET_API_S * 1000 )) ms)"
log "  gateway 2 healthy again: ${g2_ms} ms (target under $(( TARGET_API_S * 1000 )) ms)"
log "  ${TARGET} healthy after the explicit start: ${container_ms} ms"
log "  all 3 API replicas healthy: ${apis_ms} ms"
log "  entries lost: not measured (health and pg_isready only in this block)"

if [ "$g1_ms" -ge 0 ] && [ "$g1_ms" -le $(( TARGET_API_S * 1000 )) ]; then
  ok_check "gateway 1 recovered within ${TARGET_API_S}s"
else
  fail_check "gateway 1 did not recover within ${TARGET_API_S}s"
fi
if [ "$g2_ms" -ge 0 ] && [ "$g2_ms" -le $(( TARGET_API_S * 1000 )) ]; then
  ok_check "gateway 2 recovered within ${TARGET_API_S}s"
else
  fail_check "gateway 2 did not recover within ${TARGET_API_S}s"
fi
check "all 3 API replicas are healthy again" [ "$apis_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10

log "state after:"
print_cluster_state

finish
