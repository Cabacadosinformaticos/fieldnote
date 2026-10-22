#!/bin/sh
# A member is healthy when it answers and, on the follower members, when the
# whole cluster is visible. The followers only start after rabbitmq1 is up, and
# waiting for the third node here makes `compose up --wait` wait for the
# cluster instead of for three isolated brokers.
set -eu

rabbitmq-diagnostics -q ping

if [ "${RABBITMQ_REQUIRE_FULL_CLUSTER:-0}" = "1" ]; then
    running=$(rabbitmqctl cluster_status --formatter json \
        | grep -o '"running_nodes":\[[^]]*\]' \
        | grep -o 'rabbit@' \
        | wc -l)
    [ "$running" -ge 3 ]
fi
