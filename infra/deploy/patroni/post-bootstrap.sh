#!/bin/sh
# Patroni calls this once, after initdb, with a libpq connection string as $1.
# It creates the application role and database. Patroni 4 creates the
# replication role itself after this script returns.
set -eu

psql "$1" -v ON_ERROR_STOP=1 \
    -v owner="$FIELDNOTE_DB_USER" \
    -v owner_password="$FIELDNOTE_DB_PASSWORD" \
    -v owner_db="$FIELDNOTE_DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN CREATEDB PASSWORD %L', :'owner', :'owner_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'owner') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'owner_db', :'owner')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'owner_db') \gexec
SQL
