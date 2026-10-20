#!/bin/sh
# Idempotent bootstrap of the single-node Garage cluster: layout, bucket, key.
set -eu

attempts=0
until garage layout show >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 60 ]; then
        echo "Garage admin API did not become reachable" >&2
        exit 1
    fi
    sleep 1
done

node_id="$(garage node id -q | cut -d@ -f1)"
short_id="$(printf '%s' "$node_id" | cut -c1-16)"

if ! garage layout show | grep -q "$short_id"; then
    garage layout assign -z dc1 -c 1G "$node_id"
    garage layout apply --version 1
fi

if ! garage bucket info "$GARAGE_BUCKET" >/dev/null 2>&1; then
    garage bucket create "$GARAGE_BUCKET"
fi

if ! garage key list | awk 'NR > 1 { print $1 }' | grep -qx "$GARAGE_ACCESS_KEY"; then
    garage key import --yes -n dev "$GARAGE_ACCESS_KEY" "$GARAGE_SECRET_KEY"
fi

garage bucket allow --read --write "$GARAGE_BUCKET" --key "$GARAGE_ACCESS_KEY"
