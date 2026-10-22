#!/bin/sh
# Render this node's advertised RPC address, then run Garage with the
# read-only shared configuration file.
set -eu

: "${GARAGE_RPC_PUBLIC_ADDR:?GARAGE_RPC_PUBLIC_ADDR is required}"

sed "s|__RPC_PUBLIC_ADDR__|${GARAGE_RPC_PUBLIC_ADDR}|g" \
    /etc/garage.toml > /tmp/garage.toml

exec /usr/local/bin/garage -c /tmp/garage.toml server
