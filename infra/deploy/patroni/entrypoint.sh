#!/bin/sh
# Render the per-node Patroni configuration, then drop privileges and start Patroni.
set -eu

data_dir=/var/lib/postgresql/data
mkdir -p "$data_dir"
chown -R postgres:postgres "$data_dir"
# initdb refuses a data directory readable by others. The base backup of a
# replica carries the primary's mode, so set it on every start.
chmod 700 "$data_dir"

envsubst '${PATRONI_NAME} ${PG_SUPERUSER_PASSWORD} ${PG_REPLICATION_PASSWORD} ${PG_RESTAPI_PASSWORD}' \
    < /etc/patroni/patroni.yml.tmpl > /etc/patroni.yml
chown postgres:postgres /etc/patroni.yml
chmod 600 /etc/patroni.yml

exec gosu postgres /opt/patroni/bin/patroni /etc/patroni.yml
