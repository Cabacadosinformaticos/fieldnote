#!/usr/bin/env bash
# Fault scenario 3: kill the PostgreSQL primary and keep it down until Patroni
# promotes the synchronous replica, then start it again.
# Expected: the sync standby becomes leader within the 45 s target, no confirmed
# entry is lost, and the old primary rejoins as a replica. Entry persistence is
# not exercised here because this block has no load generator.
#
# Usage: bash infra/chaos/fs3-kill-primary.sh

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS3 kill the database primary"

OLD_LEADER="$(patroni_leader)" || {
  log "precondition failed: cannot read the Patroni leader"
  exit 2
}
if [ -z "$OLD_LEADER" ]; then
  log "precondition failed: Patroni has no leader"
  exit 2
fi

log "$SCENARIO: current leader $OLD_LEADER"

if ! patroni_ok 3; then
  log "precondition failed: expected 3 members, one leader and one sync standby"
  exit 2
fi
if ! pg_isready_ok "$OLD_LEADER"; then
  log "precondition failed: $OLD_LEADER is not accepting connections"
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
    log "restoring $OLD_LEADER"
    crash_start "$OLD_LEADER" || true
    OLD_STOPPED=0
  fi
}

log "injecting: SIGKILL $OLD_LEADER and keep it down until promotion"
kill_ms="$(now_ms)"
crash_stop "$OLD_LEADER"
OLD_STOPPED=1

# Sample the gateways while waiting for the new leader. The /health route is
# still a stub (it does not touch PostgreSQL), so these samples report what the
# current implementation actually does, not the fault model's expected pause.
g1_fail=0
g2_fail=0
NEW_LEADER=""
leader_now=""
deadline=$(( kill_ms + 90000 ))
while :; do
  h1="$(gateway_status "$GATEWAY1")"
  h2="$(gateway_status "$GATEWAY2")"
  [ "$h1" = "200" ] || g1_fail=$(( g1_fail + 1 ))
  [ "$h2" = "200" ] || g2_fail=$(( g2_fail + 1 ))
  leader_now="$(patroni_leader pg1 pg2 pg3 2>/dev/null)" || leader_now=""
  if [ -n "$leader_now" ] && [ "$leader_now" != "$OLD_LEADER" ]; then
    NEW_LEADER="$leader_now"
    break
  fi
  [ "$(now_ms)" -ge "$deadline" ] && break
  sleep 1
done
failover_ms=$(( $(now_ms) - kill_ms ))

if [ -z "$NEW_LEADER" ]; then
  log "measured: no new leader within 90 s (last Patroni view: ${leader_now:-none})"
  fail_check "Patroni promoted the synchronous replica within ${TARGET_DB_S}s"
else
  log "measured:"
  log "  new leader: $NEW_LEADER after ${failover_ms} ms (target up to $(( TARGET_DB_S * 1000 )) ms)"
  log "  gateway 1 failed samples during the pause: ${g1_fail}"
  log "  gateway 2 failed samples during the pause: ${g2_fail}"
  log "  old leader $OLD_LEADER: down"
  if [ "$failover_ms" -le $(( TARGET_DB_S * 1000 )) ]; then
    ok_check "new leader within ${TARGET_DB_S}s"
  else
    fail_check "new leader took ${failover_ms} ms, above the ${TARGET_DB_S}s target"
  fi
  check "the new leader accepts connections" pg_isready_ok "$NEW_LEADER"
  log "  note: the API /health route is a stub, so the gateways answered even while the database had no primary"
fi

log "restoring $OLD_LEADER"
crash_start "$OLD_LEADER"
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
log "  entries lost: not measured (health and pg_isready only in this block)"

check "the old primary rejoined and 3 members are streaming" [ "$rejoin_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10
check "api1 can reach the database through its host list" [ "$db_ok" -eq 0 ]

log "state after:"
patroni_print
print_cluster_state

finish
