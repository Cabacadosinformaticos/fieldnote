#!/usr/bin/env bash
# Fault scenario 9: restore the latest encrypted backup on a clean throwaway stack.
#
# Runs against the dev Compose project (fieldnote), not the cluster. It writes one backup on
# demand, copies the archive to the host, starts a separate Compose project with an empty
# PostgreSQL and a new single-node Garage on other ports, restores the archive into it and
# compares the counts with the source. The throwaway project is removed on exit, also on
# failure; the dev stack keeps running.
#
# The source counts leave out participants whose erasure from the app is pending, because the
# backup does too (NFR-13): their rows and their objects under entries/<participant id>/ are
# skipped.

set -uo pipefail

CHAOS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CHAOS_DIR/../.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/infra/deploy/compose.yaml"
KEY_FILE="$REPO_ROOT/infra/deploy/secrets/backup.key"
GARAGE_CONFIG="$REPO_ROOT/infra/deploy/garage/garage.toml"

PROJECT="fieldnote-fs9"
PG_PORT="${FS9_PG_PORT:-55432}"
GARAGE_S3_PORT="${FS9_GARAGE_S3_PORT:-13900}"
GARAGE_ADMIN_PORT="${FS9_GARAGE_ADMIN_PORT:-13903}"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/fieldnote-fs9.XXXXXX")" || {
  echo "cannot create a temporary directory" >&2
  exit 2
}

PYTHON="$(command -v python || command -v python3 || true)"
FAILED=0
EXIT_CODE=0

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

ok_check() {
  log "  ok    $*"
}

fail_check() {
  log "  FAIL  $*"
  FAILED=1
}

check_eq() {
  local description=$1 expected=$2 actual=$3
  if [ "$expected" = "$actual" ]; then
    ok_check "$description: $actual"
  else
    fail_check "$description: expected $expected, got $actual"
  fi
}

finish() {
  if [ "$FAILED" -eq 0 ]; then
    printf 'FS9 PASS\n'
    return 0
  fi
  printf 'FS9 FAIL\n'
  return 1
}

abort() {
  fail_check "$*"
  finish
  exit 1
}

cleanup() {
  local rc=$?
  trap - EXIT INT TERM
  if [ -f "$WORK_DIR/compose.yaml" ]; then
    ( cd "$WORK_DIR" && docker compose -p "$PROJECT" -f compose.yaml down -v --remove-orphans ) \
      >/dev/null 2>&1
  fi
  docker compose -f "$COMPOSE_FILE" exec -T backup rm -f fs9-archive.fnb >/dev/null 2>&1
  rm -rf "$WORK_DIR"
  exit "$rc"
}
trap cleanup EXIT INT TERM

compose_dev() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

compose_fs9() {
  ( cd "$WORK_DIR" && docker compose -p "$PROJECT" -f compose.yaml "$@" )
}

parse_source_stats() {
  printf '%s' "$1" | "$PYTHON" -c 'import json, sys
stats = json.load(sys.stdin)
pending = ",".join(stats["pending_participants"])
print("SOURCE_ENTRIES=%s" % stats["entries"])
print("SOURCE_MEDIA=%s" % stats["media_objects"])
print("SOURCE_BUCKET=%s" % stats["bucket_objects"])
print("SOURCE_PENDING=%s" % pending)'
}

# ---------------------------------------------------------------- prerequisites

if [ -z "$PYTHON" ]; then
  echo "infra/chaos: python is required on the host for parsing counts" >&2
  printf 'FS9 FAIL\n'
  exit 2
fi
if ! docker info >/dev/null 2>&1; then
  abort "Docker is not available"
fi
if ! docker compose -f "$COMPOSE_FILE" ps --status running >/dev/null 2>&1; then
  abort "the dev Compose project is not running"
fi

if [ ! -s "$KEY_FILE" ]; then
  mkdir -p "$(dirname "$KEY_FILE")"
  head -c 32 /dev/urandom > "$KEY_FILE"
  log "generated a development backup key at $KEY_FILE"
fi
key_size="$(wc -c < "$KEY_FILE" | tr -d '[:space:]')"
if [ "$key_size" != "32" ]; then
  abort "the backup key at $KEY_FILE must be 32 bytes, got $key_size"
fi

# ---------------------------------------------------------------- source side

log "building and starting the dev backup service"
if ! compose_dev --profile dev build backup garage-init >/dev/null 2>&1; then
  abort "could not build the backup and garage-init images"
fi
if ! compose_dev --profile dev up -d backup >/dev/null 2>&1; then
  abort "could not start the dev backup service"
fi

source_stats=""
for _ in 1 2 3 4 5; do
  if source_stats="$(compose_dev exec -T backup python -m backup stats 2>/dev/null)"; then
    break
  fi
  sleep 2
done
if [ -z "$source_stats" ]; then
  abort "the backup service did not answer the source stats command"
fi
if ! parsed_source="$(parse_source_stats "$source_stats")"; then
  abort "could not parse the source stats: $source_stats"
fi
eval "$parsed_source"
log "source: entries=$SOURCE_ENTRIES media_objects=$SOURCE_MEDIA bucket_objects=$SOURCE_BUCKET pending_participants=${SOURCE_PENDING:-none}"

run_output=""
if ! run_output="$(compose_dev exec -T backup python -m backup run 2>/dev/null)"; then
  abort "the on-demand backup failed"
fi
archive_key="$(printf '%s\n' "$run_output" | sed -n 's/^backup: archive=\([^ ]*\).*/\1/p' | tail -n 1)"
if [ -z "$archive_key" ]; then
  abort "the backup command did not report an archive: $run_output"
fi
log "backup: $archive_key"

run_counts="$(printf '%s\n' "$run_output" | sed -n 's/^backup: archive=[^ ]* //p' | tail -n 1)"
run_entries="$(printf '%s\n' "$run_counts" | sed -n 's/.*entries=\([0-9]*\).*/\1/p')"
run_media="$(printf '%s\n' "$run_counts" | sed -n 's/.*media_objects=\([0-9]*\).*/\1/p')"
run_bucket="$(printf '%s\n' "$run_counts" | sed -n 's/.*bucket_objects=\([0-9]*\).*/\1/p')"
check_eq "backup entries match the source" "$SOURCE_ENTRIES" "$run_entries"
check_eq "backup media records match the source" "$SOURCE_MEDIA" "$run_media"
check_eq "backup bucket objects match the source" "$SOURCE_BUCKET" "$run_bucket"

if ! compose_dev exec -T backup python -m backup download "$archive_key" fs9-archive.fnb >/dev/null 2>&1; then
  abort "could not download the archive from the backups bucket"
fi
if ! compose_dev cp backup:/app/fs9-archive.fnb "$WORK_DIR/archive.fnb" >/dev/null 2>&1; then
  abort "could not copy the archive to the host"
fi
archive_size="$(wc -c < "$WORK_DIR/archive.fnb" | tr -d '[:space:]')"
log "archive copied to the host: $archive_size bytes"
if [ "$archive_size" = "0" ]; then
  abort "the archive is empty"
fi

# ---------------------------------------------------------------- throwaway stack

cp "$KEY_FILE" "$WORK_DIR/backup.key"
cp "$GARAGE_CONFIG" "$WORK_DIR/garage.toml"
cp "$REPO_ROOT/infra/deploy/garage/init.sh" "$WORK_DIR/init.sh"

garage_container="$(compose_dev ps -q garage 2>/dev/null)"
if [ -z "$garage_container" ]; then
  abort "cannot find the running dev Garage container"
fi
garage_env="$(docker inspect "$garage_container" --format '{{range .Config.Env}}{{println .}}{{end}}')"
RPC_SECRET="$(printf '%s\n' "$garage_env" | sed -n 's/^GARAGE_RPC_SECRET=//p')"
ADMIN_TOKEN="$(printf '%s\n' "$garage_env" | sed -n 's/^GARAGE_ADMIN_TOKEN=//p')"
METRICS_TOKEN="$(printf '%s\n' "$garage_env" | sed -n 's/^GARAGE_METRICS_TOKEN=//p')"
S3_ACCESS_KEY="$(compose_dev exec -T backup printenv FIELDNOTE_S3_ACCESS_KEY 2>/dev/null | tr -d '\r')"
S3_SECRET_KEY="$(compose_dev exec -T backup printenv FIELDNOTE_S3_SECRET_KEY 2>/dev/null | tr -d '\r')"
for value in RPC_SECRET ADMIN_TOKEN S3_ACCESS_KEY S3_SECRET_KEY; do
  if [ -z "${!value}" ]; then
    abort "the dev stack did not provide $value"
  fi
done

cat > "$WORK_DIR/compose.yaml" <<EOF
name: $PROJECT

networks:
  internal:

volumes:
  postgres-data:
  garage-meta:
  garage-data:

secrets:
  backup_key:
    file: ./backup.key

services:
  postgres:
    image: postgres:17.8
    environment:
      POSTGRES_USER: fieldnote
      POSTGRES_PASSWORD: fieldnote-fs9
      POSTGRES_DB: fieldnote
    ports:
      - "127.0.0.1:$PG_PORT:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fieldnote -d fieldnote"]
      interval: 2s
      timeout: 3s
      retries: 30
      start_period: 5s
    networks:
      - internal

  garage:
    image: dxflrs/garage:v2.2.0
    environment:
      GARAGE_RPC_SECRET: "$RPC_SECRET"
      GARAGE_ADMIN_TOKEN: "$ADMIN_TOKEN"
      GARAGE_METRICS_TOKEN: "$METRICS_TOKEN"
    ports:
      - "127.0.0.1:$GARAGE_S3_PORT:3900"
      - "127.0.0.1:$GARAGE_ADMIN_PORT:3903"
    volumes:
      - ./garage.toml:/etc/garage.toml:ro
      - garage-meta:/var/lib/garage/meta
      - garage-data:/var/lib/garage/data
    healthcheck:
      test: ["CMD", "/garage", "status"]
      interval: 2s
      timeout: 5s
      retries: 30
      start_period: 5s
    networks:
      - internal

  garage-init:
    image: fieldnote-garage-init:latest
    environment:
      GARAGE_RPC_SECRET: "$RPC_SECRET"
      GARAGE_ADMIN_TOKEN: "$ADMIN_TOKEN"
      GARAGE_ACCESS_KEY: "$S3_ACCESS_KEY"
      GARAGE_SECRET_KEY: "$S3_SECRET_KEY"
      GARAGE_BUCKET: media
    volumes:
      - ./garage.toml:/etc/garage.toml:ro
      - ./init.sh:/init.sh:ro
      - garage-meta:/var/lib/garage/meta:ro
    depends_on:
      garage:
        condition: service_healthy
    restart: "no"
    networks:
      - internal

  restore:
    image: fieldnote-backup:latest
    environment:
      FIELDNOTE_DATABASE_URL: "postgresql+psycopg://fieldnote:fieldnote-fs9@postgres:5432/fieldnote"
      FIELDNOTE_S3_ENDPOINT: http://garage:3900
      FIELDNOTE_S3_BUCKET: media
      FIELDNOTE_BACKUPS_BUCKET: backups
      FIELDNOTE_S3_ACCESS_KEY: "$S3_ACCESS_KEY"
      FIELDNOTE_S3_SECRET_KEY: "$S3_SECRET_KEY"
      FIELDNOTE_S3_REGION: garage
      FIELDNOTE_BACKUP_KEY_FILE: /run/secrets/backup.key
      FIELDNOTE_GARAGE_ADMIN_ENDPOINT: http://garage:3903
      FIELDNOTE_GARAGE_ADMIN_TOKEN: "$ADMIN_TOKEN"
    secrets:
      - source: backup_key
        target: backup.key
    volumes:
      - ./archive.fnb:/app/archive.fnb:ro
    depends_on:
      postgres:
        condition: service_healthy
      garage-init:
        condition: service_completed_successfully
    networks:
      - internal
EOF

log "starting the clean throwaway stack (project $PROJECT, PostgreSQL on 127.0.0.1:$PG_PORT)"
if ! compose_fs9 up -d --wait postgres garage >/dev/null 2>&1; then
  abort "the throwaway PostgreSQL or Garage did not become healthy"
fi
if ! compose_fs9 run --rm garage-init >/dev/null 2>&1; then
  abort "the throwaway Garage bucket could not be initialised"
fi

restore_output=""
if ! restore_output="$(compose_fs9 run --rm restore sh -c 'python -m backup restore archive.fnb && python -m backup stats' 2>/dev/null)"; then
  abort "the restore command failed"
fi

restore_line="$(printf '%s\n' "$restore_output" | grep -m 1 '^restore: ')"
restored_stats="$(printf '%s\n' "$restore_output" | grep -m 1 '^{')"
if [ -z "$restore_line" ] || [ -z "$restored_stats" ]; then
  abort "the restore command did not report counts: $restore_output"
fi
log "$restore_line"

restored_entries="$(printf '%s' "$restore_line" | sed -n 's/.*entries=\([0-9]*\).*/\1/p')"
restored_media="$(printf '%s' "$restore_line" | sed -n 's/.*media_objects=\([0-9]*\).*/\1/p')"
restored_bucket="$(printf '%s' "$restore_line" | sed -n 's/.*bucket_objects=\([0-9]*\).*/\1/p')"
restored_stats_entries="$(printf '%s' "$restored_stats" | "$PYTHON" -c 'import json, sys; print(json.load(sys.stdin)["entries"])' 2>/dev/null)"
restored_stats_media="$(printf '%s' "$restored_stats" | "$PYTHON" -c 'import json, sys; print(json.load(sys.stdin)["media_objects"])' 2>/dev/null)"
restored_stats_bucket="$(printf '%s' "$restored_stats" | "$PYTHON" -c 'import json, sys; print(json.load(sys.stdin)["bucket_objects"])' 2>/dev/null)"

check_eq "restored entries match the source without pending erasures" "$SOURCE_ENTRIES" "$restored_entries"
check_eq "restored media records match the source without pending erasures" "$SOURCE_MEDIA" "$restored_media"
check_eq "restored bucket objects match the source without pending erasures" "$SOURCE_BUCKET" "$restored_bucket"
check_eq "restored stats entries match the restore output" "$restored_entries" "$restored_stats_entries"
check_eq "restored stats media records match the restore output" "$restored_media" "$restored_stats_media"
check_eq "restored stats bucket objects match the restore output" "$restored_bucket" "$restored_stats_bucket"

if [ -n "$SOURCE_PENDING" ]; then
  pending_array="$(printf '%s' "$SOURCE_PENDING" | sed "s/,/','/g")"
  query="SELECT count(*) FROM participant WHERE id = ANY(ARRAY['$pending_array']::uuid[])"
  absent="$(compose_fs9 exec -T postgres sh -c \
    "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$query\"" 2>/dev/null | tr -d '[:space:]')"
  check_eq "pending-erasure participants are absent from the restore" "0" "$absent"
else
  log "  ok    no erasure was pending at backup time"
fi

if finish; then
  EXIT_CODE=0
else
  EXIT_CODE=1
fi
exit "$EXIT_CODE"
