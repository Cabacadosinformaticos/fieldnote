#!/usr/bin/env bash
# Fault scenario 4: kill the synchronous database replica and keep it down until
# Patroni gives the synchronous role to the other replica, then start it again.
# Expected: writes pause for a few seconds and continue with the other replica
# as synchronous. Writing entries is not exercised here (no load generator in
# this block), so the measured value is the Patroni synchronous-role switch.
#
# Usage: bash infra/chaos/fs4-kill-sync-replica.sh

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS4 kill the synchronous replica"

OLD_SYNC="$(patroni_sync)" || {
  log "precondition failed: cannot read the Patroni sync standby"
  exit 2
}
OLD_SYNC="${OLD_SYNC%% *}"
if [ -z "$OLD_SYNC" ]; then
  log "precondition failed: Patroni has no synchronous standby"
  exit 2
fi

log "$SCENARIO: current sync standby $OLD_SYNC"

if ! patroni_ok 3; then
  log "precondition failed: expected 3 members, one leader and one sync standby"
  exit 2
fi
if ! pg_isready_ok "$OLD_SYNC"; then
  log "precondition failed: $OLD_SYNC is not accepting connections"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200 before the kill"
  exit 2
fi

log "state before:"
patroni_print
print_cluster_state

OLD_STOPPED=0
restore() {
  if [ "$OLD_STOPPED" -eq 1 ]; then
    log "restoring $OLD_SYNC"
    crash_start "$OLD_SYNC" || true
    OLD_STOPPED=0
  fi
}

log "injecting: SIGKILL $OLD_SYNC and keep it down until Patroni reassigns the role"
kill_ms="$(now_ms)"
crash_stop "$OLD_SYNC"
OLD_STOPPED=1

g1_fail=0
g2_fail=0
NEW_SYNC=""
SYNC_NOW=""
deadline=$(( kill_ms + 60000 ))
while :; do
  h1="$(gateway_status "$GATEWAY1")"
  h2="$(gateway_status "$GATEWAY2")"
  [ "$h1" = "200" ] || g1_fail=$(( g1_fail + 1 ))
  [ "$h2" = "200" ] || g2_fail=$(( g2_fail + 1 ))
  SYNC_NOW="$(patroni_sync pg1 pg2 pg3 2>/dev/null)" || SYNC_NOW=""
  SYNC_NOW="${SYNC_NOW%% *}"
  if [ -n "$SYNC_NOW" ] && [ "$SYNC_NOW" != "$OLD_SYNC" ]; then
    NEW_SYNC="$SYNC_NOW"
    break
  fi
  [ "$(now_ms)" -ge "$deadline" ] && break
  sleep 1
done
switch_ms=$(( $(now_ms) - kill_ms ))

if [ -z "$NEW_SYNC" ]; then
  log "measured: no new sync standby within 60 s (last Patroni view: ${SYNC_NOW:-none})"
  fail_check "Patroni assigned the synchronous role to the other replica"
else
  log "measured:"
  log "  new sync standby: $NEW_SYNC after ${switch_ms} ms (target: a few seconds)"
  log "  gateway 1 failed samples during the switch: ${g1_fail}"
  log "  gateway 2 failed samples during the switch: ${g2_fail}"
  log "  old sync standby $OLD_SYNC: down"
  leader_present() { [ -n "$(patroni_leader pg1 pg2 pg3 2>/dev/null)" ]; }
  check "Patroni assigned a new sync standby" true
  check "the leader is still present" leader_present
  log "  note: the write pause itself is not measured because no load generator runs in this block"
fi

log "restoring $OLD_SYNC"
crash_start "$OLD_SYNC"
OLD_STOPPED=0

if wait_until 180 2 patroni_ok 3; then
  rejoin_ms=$(( $(now_ms) - kill_ms ))
else
  rejoin_ms=-1
fi

for gateway in "$GATEWAY1" "$GATEWAY2"; do
  stable_gateway "$gateway" 3 20 || true
done
api_db_ok api1
db_ok=$?

log "measured after recovery:"
log "  3 Patroni members with one leader and one sync standby: ${rejoin_ms} ms"
log "  gateway 1: HTTP $(gateway_status "$GATEWAY1"), gateway 2: HTTP $(gateway_status "$GATEWAY2")"
log "  api1 database probe: $([ "$db_ok" -eq 0 ] && echo ok || echo failed)"

check "the returning replica rejoined and 3 members are streaming" [ "$rejoin_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10
check "api1 can reach the database through its host list" [ "$db_ok" -eq 0 ]

log "state after:"
patroni_print
print_cluster_state

finish
