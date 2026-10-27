#!/usr/bin/env bash
# Fault scenario 7: disconnect every container of one logical node from the
# cluster network, leaving the gateways on the edge network, then reconnect it.
# Expected: the isolated node stops reaching the other two, the pair keeps
# serving and keeps quorums, and the node resynchronises when reconnected.
#
# By default the script picks a node that is neither the Patroni leader nor the
# synchronous standby, so the pair that stays connected has both database roles.
# Pass node1, node2 or node3 to force a target.
#
# Usage: bash infra/chaos/fs7-partition-node.sh [node1|node2|node3]

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS7 partition one logical node"
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

NODE_NUMBER="${TARGET_NODE#node}"
SURVIVING_PG=()
SURVIVING_RABBIT=()
SURVIVING_GARAGE=()
for number in 1 2 3; do
  [ "$number" = "$NODE_NUMBER" ] && continue
  SURVIVING_PG+=("pg$number")
  SURVIVING_RABBIT+=("rabbitmq$number")
  SURVIVING_GARAGE+=("garage$number")
done

# Containers of the node that are attached to the cluster network. Traefik is
# only on edge and is deliberately not touched.
DISCONNECTED=()
for service in $(node_services "$TARGET_NODE"); do
  if docker inspect -f '{{json .NetworkSettings.Networks}}' "$service" 2>/dev/null \
      | grep -q "\"${CLUSTER_NETWORK}\""; then
    DISCONNECTED+=("$service")
  fi
done

log "$SCENARIO: target $TARGET_NODE (${DISCONNECTED[*]})"

if [ "${#DISCONNECTED[@]}" -eq 0 ]; then
  log "precondition failed: no container of $TARGET_NODE is on $CLUSTER_NETWORK"
  exit 2
fi
if ! node_ok "$TARGET_NODE"; then
  log "precondition failed: every container of $TARGET_NODE must be healthy/running"
  exit 2
fi
if ! patroni_ok 3 || ! rabbit_ok 3 || ! garage_ok 3; then
  log "precondition failed: all three members must be present in every cluster"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200 before the partition"
  exit 2
fi

log "state before:"
print_cluster_state

PARTITIONED=0
restore() {
  local service
  if [ "$PARTITIONED" -eq 1 ]; then
    log "reconnecting $TARGET_NODE to $CLUSTER_NETWORK"
    for service in "${DISCONNECTED[@]}"; do
      docker network connect "$CLUSTER_NETWORK" "$service" >/dev/null 2>&1 || true
    done
    PARTITIONED=0
  fi
}

log "injecting: disconnect ${DISCONNECTED[*]} from $CLUSTER_NETWORK"
partition_ms="$(now_ms)"
for service in "${DISCONNECTED[@]}"; do
  docker network disconnect -f "$CLUSTER_NETWORK" "$service" >/dev/null
done
PARTITIONED=1

# The connected pair must keep both database roles and 2 of 3 members.
if wait_until 90 1 patroni_ok 2 "${SURVIVING_PG[@]}"; then
  patroni_ms=$(( $(now_ms) - partition_ms ))
else
  patroni_ms=-1
fi

rabbit_two() {
  [ "$(rabbit_count "${SURVIVING_RABBIT[@]}" 2>/dev/null)" = "2" ]
}
if wait_until 60 1 rabbit_two; then
  rabbit_ms=$(( $(now_ms) - partition_ms ))
else
  rabbit_ms=-1
fi
if wait_until 90 1 garage_ok 2 "${SURVIVING_GARAGE[@]}"; then
  garage_ms=$(( $(now_ms) - partition_ms ))
else
  garage_ms=-1
fi

# The isolated API must not be able to reach PostgreSQL, even though its local
# /health route is a stub that still answers 200.
ISOLATED_API="api${NODE_NUMBER}"
api_db_ok "$ISOLATED_API"
isolated_db_rc=$?

gateway_ok=1
stable_gateway "$GATEWAY1" 3 20 || gateway_ok=0
stable_gateway "$GATEWAY2" 3 20 || gateway_ok=0

patroni_now="$(patroni_member_count "${SURVIVING_PG[@]}" 2>/dev/null)" || patroni_now="?"
rabbit_now="$(rabbit_count "${SURVIVING_RABBIT[@]}" 2>/dev/null)" || rabbit_now="?"
garage_now="$(garage_count "${SURVIVING_GARAGE[@]}" 2>/dev/null)" || garage_now="?"

log "measured while $TARGET_NODE is isolated:"
log "  patroni members seen by the pair: ${patroni_now}/3"
log "  rabbitmq running nodes seen by the pair: ${rabbit_now}/3"
log "  garage healthy nodes seen by the pair: ${garage_now}/3"
log "  $ISOLATED_API database probe: $([ "$isolated_db_rc" -ne 0 ] && echo 'unreachable (isolated)' || echo 'REACHABLE (partition failed)')"
log "  gateways: $([ "$gateway_ok" -eq 1 ] && echo 'both answer HTTP 200' || echo 'a gateway failed')"

[ "$patroni_ms" -ge 0 ] && ok_check "the pair kept the leader and the sync standby" || fail_check "the pair lost a database role"
[ "$rabbit_ms" -ge 0 ] && ok_check "the pair kept 2 of 3 broker nodes" || fail_check "the pair lost the broker quorum"
[ "$garage_ms" -ge 0 ] && ok_check "the pair kept 2 of 3 storage nodes" || fail_check "the pair lost storage quorum"
[ "$isolated_db_rc" -ne 0 ] && ok_check "the isolated API cannot reach PostgreSQL" || fail_check "the isolated API still reached PostgreSQL"
[ "$gateway_ok" -eq 1 ] && ok_check "both gateways kept answering through the edge network" || fail_check "a gateway stopped answering"
log "  note: /api/v1/health does not touch PostgreSQL yet, so the isolated replica still answered it"

restore_ms="$(now_ms)"
restore
PARTITIONED=0
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
api_db_ok "$ISOLATED_API"
db_ok=$?

log "measured after reconnection:"
log "  all 3 members again: ${recover_ms} ms after reconnection"
log "  gateway 1: HTTP $(gateway_status "$GATEWAY1"), gateway 2: HTTP $(gateway_status "$GATEWAY2")"
log "  $ISOLATED_API database probe: $([ "$db_ok" -eq 0 ] && echo ok || echo failed)"

check "the node rejoined every cluster" [ "$recover_ms" -ge 0 ]
check "gateway 1 answers HTTP 200" stable_gateway "$GATEWAY1" 3 10
check "gateway 2 answers HTTP 200" stable_gateway "$GATEWAY2" 3 10
check "$ISOLATED_API can reach the database again" [ "$db_ok" -eq 0 ]

log "state after:"
print_cluster_state

finish
