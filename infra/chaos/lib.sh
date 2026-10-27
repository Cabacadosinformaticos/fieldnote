#!/usr/bin/env bash
# Shared helpers for the failure-injection scenarios of the cluster profile.
# Source it from a scenario script; it installs an EXIT trap that calls the
# scenario's restore() so a failed or interrupted run still puts the cluster back.
#
# Everything runs from the host against the Compose project fieldnote-cluster.
# The brief for this block asks for health and pg_isready checks only; entry
# load arrives later with the load generator.

set -uo pipefail

CHAOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CHAOS_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/deploy/compose.cluster.yaml"
CLUSTER_NETWORK="fieldnote-cluster_cluster"

GATEWAY1="http://127.0.0.1:8090"
GATEWAY2="http://127.0.0.1:8092"

# Recovery-time targets from fault-model.md.
TARGET_API_S=5
TARGET_DB_S=45
TARGET_MEMBER_S=60

SCENARIO="${SCENARIO:-}"
FAILED=0

PYTHON="$(command -v python || command -v python3 || true)"
if [ -z "$PYTHON" ]; then
  echo "infra/chaos: python is required on the host for the HTTP, JSON and DB probes" >&2
  exit 2
fi

# ---------------------------------------------------------------- logging

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

now_ms() {
  date +%s%3N
}

ok_check() { log "  ok    $*"; }

fail_check() {
  log "  FAIL  $*"
  FAILED=1
}

# check <description> <command...>
check() {
  local desc=$1
  shift
  if "$@"; then
    ok_check "$desc"
  else
    fail_check "$desc"
    return 1
  fi
}

finish() {
  if [ "$FAILED" -eq 0 ]; then
    log "PASS $SCENARIO"
    return 0
  fi
  log "FAIL $SCENARIO"
  return 1
}

# ---------------------------------------------------------------- lifecycle

# Scenarios override this. The EXIT trap calls it once.
restore() { :; }

on_exit() {
  local rc=$?
  trap - EXIT INT TERM
  restore
  exit "$rc"
}

trap on_exit EXIT INT TERM

# ---------------------------------------------------------------- compose

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

container_running() {
  [ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]
}

container_ok() {
  local state
  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null)"
  [ "$state" = "healthy" ] || [ "$state" = "running" ]
}

first_running() {
  local name
  for name in "$@"; do
    if container_running "$name"; then
      echo "$name"
      return 0
    fi
  done
  return 1
}

# Always 127.0.0.1: localhost resolves to IPv6 first on the Windows host and
# Docker publishes on IPv4 only.
http_status() {
  "$PYTHON" -c 'import sys, urllib.request, urllib.error
try:
    with urllib.request.urlopen(sys.argv[1], timeout=3) as response:
        print(response.status)
except urllib.error.HTTPError as error:
    print(error.code)
except Exception:
    print(0)' "$1" 2>/dev/null
}

gateway_status() {
  http_status "${1%/}/api/v1/health"
}

api_health() {
  [ "$(gateway_status "$1")" = "200" ]
}

# Wait until the endpoint answers 200 on <need> consecutive samples.
stable_gateway() {
  local url=$1
  local need=${2:-3}
  local timeout=${3:-15}
  local streak=0
  local deadline=$(( $(now_ms) + timeout * 1000 ))
  while :; do
    if api_health "$url"; then
      streak=$((streak + 1))
      [ "$streak" -ge "$need" ] && return 0
    else
      streak=0
    fi
    [ "$(now_ms)" -ge "$deadline" ] && return 1
    sleep 0.5
  done
}

wait_until() {
  local timeout=$1
  local interval=$2
  shift 2
  local deadline=$(( $(now_ms) + timeout * 1000 ))
  while :; do
    if "$@" >/dev/null 2>&1; then
      return 0
    fi
    [ "$(now_ms)" -ge "$deadline" ] && return 1
    sleep "$interval"
  done
}

# ---------------------------------------------------------------- PostgreSQL

pg_isready_ok() {
  compose exec -T "$1" pg_isready -h 127.0.0.1 -p 5432 -U postgres >/dev/null 2>&1
}

patroni_json() {
  [ "$#" -eq 0 ] && set -- pg1 pg2 pg3
  local host
  host="$(first_running "$@")" || return 1
  compose exec -T "$host" patronictl list -f json 2>/dev/null
}

patroni_print() {
  local host
  host="$(first_running "$@")" || return 1
  compose exec -T "$host" patronictl list 2>/dev/null | tr -d '\r'
}

patroni_roles() {
  local role=$1
  shift
  local json
  json="$(patroni_json "$@")" || return 1
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
role = sys.argv[1]
members = json.load(sys.stdin)
print(" ".join(m.get("Member", "") for m in members if m.get("Role") == role))' "$role"
}

patroni_leader() { patroni_roles Leader "$@"; }

patroni_sync() { patroni_roles "Sync Standby" "$@"; }

# patroni_ok <expected member count> [candidate members]
patroni_ok() {
  local want=$1
  shift
  local json
  json="$(patroni_json "$@")" || return 1
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
want = int(sys.argv[1])
members = json.load(sys.stdin)
roles = [m.get("Role") for m in members]
states = [m.get("State") for m in members]
ok = (len(members) == want
      and roles.count("Leader") == 1
      and roles.count("Sync Standby") == 1
      and all(s in ("running", "streaming") for s in states))
sys.exit(0 if ok else 1)' "$want"
}

patroni_member_count() {
  local json
  json="$(patroni_json "$@")" || { echo 0; return 0; }
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
try:
    print(len(json.load(sys.stdin)))
except Exception:
    print(0)'
}

# A real readiness probe for the API: the /health route is still a stub, so a
# database-independent 200 does not prove that the replica can reach PostgreSQL.
api_db_ok() {
  compose exec -T "$1" python -c 'import os, psycopg
url = os.environ["FIELDNOTE_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://", 1)
with psycopg.connect(url, connect_timeout=3) as connection:
    connection.execute("select 1")' >/dev/null 2>&1
}

# ---------------------------------------------------------------- RabbitMQ

rabbit_json() {
  [ "$#" -eq 0 ] && set -- rabbitmq1 rabbitmq2 rabbitmq3
  local host
  host="$(first_running "$@")" || return 1
  compose exec -T "$host" rabbitmqctl cluster_status --formatter json 2>/dev/null
}

rabbit_count() {
  local json
  json="$(rabbit_json "$@")" || return 1
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
print(len(json.load(sys.stdin).get("running_nodes", [])))'
}

rabbit_partitions() {
  local json
  json="$(rabbit_json "$@")" || return 1
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
print(len(json.load(sys.stdin).get("partitions") or {}))'
}

# rabbit_ok <expected running nodes> [candidate nodes]
rabbit_ok() {
  local want=$1
  shift
  local json
  json="$(rabbit_json "$@")" || return 1
  printf '%s' "$json" | "$PYTHON" -c 'import json, sys
want = int(sys.argv[1])
status = json.load(sys.stdin)
ok = (len(status.get("running_nodes", [])) == want
      and not (status.get("partitions") or {}))
sys.exit(0 if ok else 1)' "$want"
}

# ---------------------------------------------------------------- Garage

garage_status() {
  [ "$#" -eq 0 ] && set -- garage1 garage2 garage3
  local host
  host="$(first_running "$@")" || return 1
  # GARAGE_CONFIG_FILE points at the rendered config; no absolute container path
  # is passed here because Git Bash would rewrite it on the Windows host.
  compose exec -T "$host" garage status 2>/dev/null
}

garage_hosts() {
  garage_status "$@" | awk '
    /HEALTHY NODES/ { healthy = 1; next }
    /^====/        { healthy = 0 }
    healthy && $1 ~ /^[0-9a-f]{16}$/ { print $2 }
  '
}

garage_count() {
  garage_hosts "$@" | grep -c . || true
}

# garage_ok <expected healthy nodes> [candidate nodes]
garage_ok() {
  local want=$1
  shift
  [ "$(garage_count "$@")" = "$want" ]
}

# ---------------------------------------------------------------- nodes

# The containers Compose gives each logical node. migrate and
# garage-cluster-init are one-shot services and are not part of a node.
node_services() {
  case "$1" in
    node1) echo "etcd1 pg1 rabbitmq1 garage1 api1 traefik1 outbox-relay1" ;;
    node2) echo "etcd2 pg2 rabbitmq2 garage2 api2 traefik2 outbox-relay2 media-worker2" ;;
    node3) echo "etcd3 pg3 rabbitmq3 garage3 api3 media-worker3" ;;
    *) return 1 ;;
  esac
}

service_exists() {
  docker inspect "$1" >/dev/null 2>&1
}

# The containers of a node that actually exist in the Compose project. A
# service can be defined but never created (for example a profile started
# before that service was added), and stopping it would fail.
node_containers() {
  local -a services
  local service
  local -a existing=()
  read -ra services <<< "$(node_services "$1")" || return 1
  for service in "${services[@]}"; do
    service_exists "$service" && existing+=("$service")
  done
  [ "${#existing[@]}" -gt 0 ] || return 1
  printf '%s\n' "${existing[*]}"
}

node_ok() {
  local -a services
  local service
  read -ra services <<< "$(node_containers "$1")" || return 1
  for service in "${services[@]}"; do
    container_ok "$service" || return 1
  done
}

node_down() {
  local -a services
  local service
  read -ra services <<< "$(node_containers "$1")" || return 1
  for service in "${services[@]}"; do
    if container_running "$service"; then
      return 1
    fi
  done
  return 0
}

# The gateways live on nodes 1 and 2; node 3 has none.
surviving_gateways() {
  local node=$1
  [ "$node" != "node1" ] && echo "$GATEWAY1"
  [ "$node" != "node2" ] && echo "$GATEWAY2"
}

# Pick a node that holds neither the leader nor the synchronous standby, so a
# scenario about node loss does not also become a database failover.
pick_spare_node() {
  local leader sync leader_node sync_node node
  leader="$(patroni_leader)" || return 1
  sync="$(patroni_sync)" || return 1
  [ -n "$leader" ] && [ -n "$sync" ] || return 1
  leader_node="node${leader#pg}"
  sync_node="node${sync#pg}"
  for node in node2 node3 node1; do
    if [ "$node" != "$leader_node" ] && [ "$node" != "$sync_node" ]; then
      echo "$node"
      return 0
    fi
  done
  return 1
}

# SIGKILL and keep the container down until crash_start. A manual docker kill is
# a manual stop, so Docker's restart policy already leaves it down; setting the
# policy to no makes that explicit and survives a daemon restart mid-scenario.
crash_stop() {
  docker update --restart=no "$1" >/dev/null 2>&1 || return 1
  docker kill "$1" >/dev/null 2>&1
}

crash_start() {
  docker update --restart=unless-stopped "$1" >/dev/null 2>&1 || return 1
  docker start "$1" >/dev/null 2>&1
}

# ---------------------------------------------------------------- reports

print_cluster_state() {
  local leader sync members rabbit garage h1 h2
  leader="$(patroni_leader 2>/dev/null)" || leader="?"
  sync="$(patroni_sync 2>/dev/null)" || sync="?"
  members="$(patroni_member_count 2>/dev/null)" || members=0
  rabbit="$(rabbit_count rabbitmq1 rabbitmq2 rabbitmq3 2>/dev/null)" || rabbit="?"
  garage="$(garage_count garage1 garage2 garage3 2>/dev/null)" || garage="?"
  h1="$(gateway_status "$GATEWAY1")"
  h2="$(gateway_status "$GATEWAY2")"
  log "  patroni: ${members}/3 members, leader ${leader:-none}, sync standby ${sync:-none}"
  log "  rabbitmq: ${rabbit}/3 running, garage: ${garage}/3 healthy"
  log "  gateway 1 (127.0.0.1:8090): HTTP ${h1}, gateway 2 (127.0.0.1:8092): HTTP ${h2}"
}
