#!/usr/bin/env bash
# Fault scenario 6: kill one RabbitMQ node and keep it down while the other two
# carry the cluster, then start it again.
# Expected: quorum queues continue on 2 nodes and no event is lost. Event
# delivery is not measured here because no load generator runs in this block;
# the outbox keeps events in PostgreSQL while the broker is short a member.
#
# Usage: bash infra/chaos/fs6-kill-broker.sh [rabbitmq1|rabbitmq2|rabbitmq3]

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS6 kill a broker node"
TARGET="${1:-rabbitmq2}"

case "$TARGET" in
  rabbitmq1|rabbitmq2|rabbitmq3) ;;
  *) log "unknown broker container: $TARGET"; exit 2 ;;
esac

log "$SCENARIO: target $TARGET"

if ! container_ok "$TARGET"; then
  log "precondition failed: $TARGET is not healthy/running"
  exit 2
fi
if ! rabbit_ok 3 || ! patroni_ok 3; then
  log "precondition failed: all three brokers must be running and Patroni must be healthy"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200 before the kill"
  exit 2
fi

log "state before:"
print_cluster_state

TARGET_STOPPED=0
restore() {
  if [ "$TARGET_STOPPED" -eq 1 ]; then
    log "restoring $TARGET"
    crash_start "$TARGET" || true
    TARGET_STOPPED=0
  fi
}

log "injecting: SIGKILL $TARGET and keep it down while the quorum is 2 of 3"
kill_ms="$(now_ms)"
crash_stop "$TARGET"
TARGET_STOPPED=1

if wait_until 60 1 rabbit_ok 2 rabbitmq1 rabbitmq2 rabbitmq3; then
  quorum_ms=$(( $(now_ms) - kill_ms ))
else
  quorum_ms=-1
fi

rabbit_now="$(rabbit_count rabbitmq1 rabbitmq2 rabbitmq3 2>/dev/null)" || rabbit_now="?"
partitions_now="$(rabbit_partitions rabbitmq1 rabbitmq2 rabbitmq3 2>/dev/null)" || partitions_now="?"
g1="$(gateway_status "$GATEWAY1")"
g2="$(gateway_status "$GATEWAY2")"

log "measured while $TARGET is down:"
log "  broker left the running set after: ${quorum_ms} ms"
log "  rabbitmq running nodes: ${rabbit_now}/3"
log "  network partitions: ${partitions_now}"
log "  gateway 1: HTTP ${g1}, gateway 2: HTTP ${g2}"
log "  events lost: not measured (no load generator and no event flow in this block)"

[ "$quorum_ms" -ge 0 ] && ok_check "the other two brokers kept the cluster with no partition" || fail_check "the broker cluster lost its quorum"
check "both gateways still answer HTTP 200" api_health "$GATEWAY1"
check "gateway 2 still answers HTTP 200" api_health "$GATEWAY2"

log "restoring $TARGET"
crash_start "$TARGET"
TARGET_STOPPED=0

if wait_until 180 1 rabbit_ok 3; then
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
log "  3 running broker nodes with no partition: ${rejoin_ms} ms"
log "  gateway 1: HTTP $(gateway_status "$GATEWAY1"), gateway 2: HTTP $(gateway_status "$GATEWAY2")"
log "  api1 database probe: $([ "$db_ok" -eq 0 ] && echo ok || echo failed)"

check "the broker rejoined the cluster" [ "$rejoin_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10
check "api1 can reach the database through its host list" [ "$db_ok" -eq 0 ]

log "state after:"
print_cluster_state

finish
