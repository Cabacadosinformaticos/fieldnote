#!/usr/bin/env bash
# Fault scenario 11: kill the scheduler replica that holds the leader lease.
# Expected: the standby takes the lease in under 20 s (lease TTL 15 s plus one
# 5 s tick, per fault-model.md) and the killed replica comes back as a standby.
#
# The active replica is found in the leader_lease table, not guessed from logs.
#
# Usage: bash infra/chaos/fs11-kill-scheduler.sh

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS11 kill the active scheduler replica"
TAKEOVER_TARGET_MS="${FS11_TAKEOVER_TARGET_MS:-20000}"

ACTIVE=""
STANDBY=""
ACTIVE_DOWN=0

restore() {
  if [ "$ACTIVE_DOWN" -eq 1 ] && [ -n "$ACTIVE" ]; then
    log "restoring $ACTIVE"
    crash_start "$ACTIVE" >/dev/null 2>&1 || docker start "$ACTIVE" >/dev/null 2>&1 || true
    ACTIVE_DOWN=0
  fi
}

# Prints "<holder>|<expires_at > now()>" or "none|false".
lease_state() {
  compose exec -T api1 python -c '
import os
import psycopg

url = os.environ["FIELDNOTE_DATABASE_URL"].replace(
    "postgresql+psycopg://", "postgresql://", 1
)
with psycopg.connect(url, connect_timeout=3) as connection:
    row = connection.execute(
        "SELECT holder, expires_at > now() FROM leader_lease WHERE name = %s",
        ("scheduler",),
    ).fetchone()
print("none|false" if row is None else f"{row[0]}|{str(row[1]).lower()}")
' 2>/dev/null | tr -d '\r'
}

# The takeover is complete when the row is live and held by the other replica.
takeover_done() {
  local state current held
  state="$(lease_state)" || return 1
  current="${state%%|*}"
  held="${state##*|}"
  [ "$held" = "true" ] && [ "${current%%:*}" = "$STANDBY" ]
}

log "$SCENARIO"

if ! container_ok scheduler1 || ! container_ok scheduler2; then
  log "precondition failed: scheduler1 and scheduler2 must both be running"
  exit 2
fi

initial="$(lease_state)" || initial=""
if [ -z "$initial" ]; then
  log "precondition failed: cannot read leader_lease through api1"
  exit 2
fi
holder="${initial%%|*}"
held="${initial##*|}"
if [ "$held" != "true" ] || [ "$holder" = "none" ]; then
  log "precondition failed: no live scheduler lease (got $initial)"
  exit 2
fi

case "$holder" in
  scheduler1:*) ACTIVE=scheduler1; STANDBY=scheduler2 ;;
  scheduler2:*) ACTIVE=scheduler2; STANDBY=scheduler1 ;;
  *)
    log "precondition failed: lease holder '$holder' is not one of the cluster replicas"
    exit 2
    ;;
esac

log "state before:"
print_cluster_state
log "  scheduler lease: $holder (held), active $ACTIVE, standby $STANDBY"

log "injecting: docker kill $ACTIVE (the lease holder)"
kill_ms="$(now_ms)"
crash_stop "$ACTIVE"
ACTIVE_DOWN=1

if wait_until 40 0.5 takeover_done; then
  takeover_ms=$(( $(now_ms) - kill_ms ))
else
  takeover_ms=-1
fi

after="$(lease_state)" || after=""
new_holder="${after%%|*}"
new_held="${after##*|}"

log "measured while $ACTIVE was stopped:"
log "  standby $STANDBY took the live lease after ${takeover_ms} ms"
log "  lease row now: ${new_holder:-?} (held: ${new_held:-?})"

restore_start="$(now_ms)"
log "restarting $ACTIVE"
crash_start "$ACTIVE"
ACTIVE_DOWN=0
if wait_until 60 1 container_ok "$ACTIVE"; then
  restart_ms=$(( $(now_ms) - restore_start ))
  active_back=0
else
  restart_ms=-1
  active_back=1
fi

log "measured after $ACTIVE returned:"
log "  $ACTIVE running again after ${restart_ms} ms"
log "  lease row: $(lease_state 2>/dev/null || echo '?')"
log "  scheduler1 running: $(container_running scheduler1 && echo yes || echo no)"
log "  scheduler2 running: $(container_running scheduler2 && echo yes || echo no)"

[ "$takeover_ms" -ge 0 ] && ok_check "the standby took over" || fail_check "the standby did not take over"
if [ "$takeover_ms" -ge 0 ] && [ "$takeover_ms" -le "$TAKEOVER_TARGET_MS" ]; then
  ok_check "takeover took ${takeover_ms} ms (target <= ${TAKEOVER_TARGET_MS} ms)"
else
  fail_check "takeover took ${takeover_ms} ms (target <= ${TAKEOVER_TARGET_MS} ms)"
fi
if [ "$new_held" = "true" ] && [ "${new_holder%%:*}" = "$STANDBY" ]; then
  ok_check "the lease is held by $STANDBY"
else
  fail_check "the lease is not held by $STANDBY (got ${new_holder:-none})"
fi
[ "$active_back" -eq 0 ] && ok_check "$ACTIVE is running again" || fail_check "$ACTIVE did not start"
schedulers_running() {
  container_running scheduler1 && container_running scheduler2
}
check "both schedulers are running" schedulers_running

log "state after:"
print_cluster_state

finish
