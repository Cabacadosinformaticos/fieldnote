#!/bin/sh
# Render this node's advertised RPC address, run Garage, and keep it connected
# to the other members. The reconnect runs on every start, so restarting one
# node or the whole host does not leave the cluster split.
set -eu

: "${GARAGE_RPC_PUBLIC_ADDR:?GARAGE_RPC_PUBLIC_ADDR is required}"

sed "s|__RPC_PUBLIC_ADDR__|${GARAGE_RPC_PUBLIC_ADDR}|g" \
    /etc/garage.toml > /tmp/garage.toml

/usr/local/bin/garage -c /tmp/garage.toml server &
server_pid=$!
python3 /usr/local/bin/garage-cluster-bootstrap.py &
bootstrap_pid=$!

forward() {
    kill -TERM "$server_pid" 2>/dev/null || true
}
trap forward TERM INT

status=0
if ! wait "$server_pid"; then
    status=$?
fi
kill "$bootstrap_pid" 2>/dev/null || true
exit "$status"
