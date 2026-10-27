#!/usr/bin/env bash
# Fault scenario 2: stop every container of one logical node, then start the
# node again. Expected: the two remaining nodes keep serving and every cluster
# keeps a quorum; the returning node rejoins and catches up.
#
# By default the script picks a node that is neither the Patroni leader nor the
# synchronous standby, so the scenario stays about losing a node and not about a
# database failover. Pass node1, node2 or node3 to force a target.
#
# Usage: bash infra/chaos/fs2-stop-node.sh [node1|node2|node3]

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS2 stop one logical node"
TARGET_NODE="${1:-}"

if [ -z "$TARGET_NODE" ]; then
  TARGET_NODE="$(pick_spare_node)" || {
    log "could not find a node that holds neither the leader nor the sync standby"
    exit 2
  }
fi
case "$TARGET_NODE" in
  node1|node2|node3) ;;
  *) log "unknown node: $TARGET_NODE"; exit 2 ;;
esac

NODE_SERVICES="$(node_containers "$TARGET_NODE")" || {
  log "precondition failed: $TARGET_NODE has no existing containers"
  exit 2
}
read -ra NODE_SERVICES_ARR <<< "$NODE_SERVICES"

log "$SCENARIO: target $TARGET_NODE"

if ! node_ok "$TARGET_NODE"; then
  log "precondition failed: every container of $TARGET_NODE must be healthy/running"
  exit 2
fi
if ! patroni_ok 3 || ! rabbit_ok 3 || ! garage_ok 3; then
  log "precondition failed: all three members must be present in every cluster"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200 before the stop"
  exit 2
fi

log "state before:"
print_cluster_state

NODE_STOPPED=0
restore() {
  if [ "$NODE_STOPPED" -eq 1 ]; then
    log "restoring $TARGET_NODE: ${NODE_SERVICES_ARR[*]}"
    # docker start, not compose start: compose rechecks depends_on and refuses
    # when a one-shot dependency such as migrate no longer exists.
    docker start "${NODE_SERVICES_ARR[@]}" >/dev/null 2>&1 || true
    NODE_STOPPED=0
  fi
}

log "injecting: compose stop ${NODE_SERVICES_ARR[*]}"
stop_ms="$(now_ms)"
compose stop -t 5 "${NODE_SERVICES_ARR[@]}" >/dev/null
NODE_STOPPED=1

if wait_until 15 1 node_down "$TARGET_NODE"; then
  down_ms=$(( $(now_ms) - stop_ms ))
else
  down_ms=-1
fi

# The other two members of each cluster must carry on.
if wait_until 60 1 patroni_ok 2; then
  patroni_ms=$(( $(now_ms) - stop_ms ))
else
  patroni_ms=-1
fi
if wait_until 60 1 rabbit_ok 2 rabbitmq1 rabbitmq2 rabbitmq3; then
  rabbit_ms=$(( $(now_ms) - stop_ms ))
else
  rabbit_ms=-1
fi
if wait_until 90 1 garage_ok 2 garage1 garage2 garage3; then
  garage_ms=$(( $(now_ms) - stop_ms ))
else
  garage_ms=-1
fi

# Gateways on the surviving nodes must keep serving.
readarray -t SURVIVING_GATEWAYS < <(surviving_gateways "$TARGET_NODE")
gateway_ok=1
for gateway in "${SURVIVING_GATEWAYS[@]}"; do
  stable_gateway "$gateway" 3 20 || gateway_ok=0
done

rabbit_now="$(rabbit_count rabbitmq1 rabbitmq2 rabbitmq3 2>/dev/null)" || rabbit_now="?"
garage_now="$(garage_count garage1 garage2 garage3 2>/dev/null)" || garage_now="?"
patroni_now="$(patroni_member_count 2>/dev/null)" || patroni_now="?"

log "measured while $TARGET_NODE is down:"
log "  containers stopped: ${down_ms} ms"
log "  patroni members: ${patroni_now}/3 (leader and sync standby present: $([ "$patroni_ms" -ge 0 ] && echo yes || echo no))"
log "  rabbitmq running nodes: ${rabbit_now}/3"
log "  garage healthy nodes: ${garage_now}/3"
log "  surviving gateways (${SURVIVING_GATEWAYS[*]}): $([ "$gateway_ok" -eq 1 ] && echo healthy || echo FAILED)"

[ "$down_ms" -ge 0 ] && ok_check "all $TARGET_NODE containers stopped" || fail_check "some $TARGET_NODE containers kept running"
[ "$patroni_ms" -ge 0 ] && ok_check "Patroni kept a leader and a sync standby with 2 of 3 members" || fail_check "Patroni lost quorum or the sync standby"
[ "$rabbit_ms" -ge 0 ] && ok_check "RabbitMQ kept 2 of 3 running nodes with no partition" || fail_check "RabbitMQ did not keep a quorum"
[ "$garage_ms" -ge 0 ] && ok_check "Garage kept 2 of 3 healthy nodes" || fail_check "Garage did not keep 2 healthy nodes"
[ "$gateway_ok" -eq 1 ] && ok_check "the surviving gateway(s) answered HTTP 200" || fail_check "a surviving gateway did not answer"

restore_ms="$(now_ms)"
restore
NODE_STOPPED=0
recovered() {
  node_ok "$TARGET_NODE" && patroni_ok 3 && rabbit_ok 3 && garage_ok 3
}
if wait_until 180 2 recovered; then
  recover_ms=$(( $(now_ms) - restore_ms ))
else
  recover_ms=-1
fi

for gateway in "$GATEWAY1" "$GATEWAY2"; do
  stable_gateway "$gateway" 3 20 || true
done
PROBE_API=api1
[ "$TARGET_NODE" = "node1" ] && PROBE_API=api2
api_db_ok "$PROBE_API"
db_ok=$?

log "measured after the node returned:"
log "  full cluster again: ${recover_ms} ms after the restart"
log "  gateway 1: HTTP $(gateway_status "$GATEWAY1"), gateway 2: HTTP $(gateway_status "$GATEWAY2")"
log "  ${PROBE_API} database probe: $([ "$db_ok" -eq 0 ] && echo ok || echo failed)"
log "  entries lost: not measured (health and pg_isready only in this block)"

check "the returning node rejoined every cluster" [ "$recover_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10
check "$PROBE_API can reach the database" [ "$db_ok" -eq 0 ]

log "state after:"
print_cluster_state

finish
