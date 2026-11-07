#!/usr/bin/env bash
# Fault scenario 5: kill one object storage node while the load generator uploads
# entries with media. Expected: uploads finish on the remaining two nodes (a failed
# upload is retried with a new signed URL), every uploaded file is readable, and the
# killed node rejoins Garage when it starts again.
#
# The load generator creates its own researcher, study and phones, sends a text or a
# photo every few seconds, and verifies the entries and files at the end. It exits
# non-zero on a lost or duplicated entry or an unreadable file.
#
# Usage: bash infra/chaos/fs5-kill-storage-node.sh [garage1|garage2|garage3]

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS5 kill a storage node during media uploads"
TARGET="${1:-garage2}"

case "$TARGET" in
  garage1|garage2|garage3) ;;
  *) log "unknown storage node: $TARGET"; exit 2 ;;
esac

PARTICIPANTS="${FS5_PARTICIPANTS:-10}"
MINUTES="${FS5_MINUTES:-1}"
RATE="${FS5_RATE:-12}"
SEED="${FS5_SEED:-5}"

LOADGEN_ADMIN_EMAIL="${FIELDNOTE_LOADGEN_ADMIN_EMAIL:-loadgen-fs5-$(date +%s)-$$@fieldnote.test}"
LOADGEN_ADMIN_PASSWORD="${FIELDNOTE_LOADGEN_ADMIN_PASSWORD:-LoadgenCluster!2026}"
LOG_FILE="$(mktemp -t fieldnote-fs5-XXXXXX.log)"
TARGET_DOWN=0
LOADGEN_PID=""

restore() {
  if [ -n "$LOADGEN_PID" ] && kill -0 "$LOADGEN_PID" 2>/dev/null; then
    kill "$LOADGEN_PID" 2>/dev/null || true
    wait "$LOADGEN_PID" 2>/dev/null || true
    LOADGEN_PID=""
  fi
  if [ "$TARGET_DOWN" -eq 1 ]; then
    log "restoring $TARGET"
    crash_start "$TARGET" >/dev/null 2>&1 || docker start "$TARGET" >/dev/null 2>&1 || true
    TARGET_DOWN=0
  fi
  rm -f "$LOG_FILE"
}

summary_value() {
  sed -n "s/^$1: //p" "$LOG_FILE" | tail -n 1
}

print_loadgen_summary() {
  grep -E '^(study|participants|attempts|sent|confirmed|retried|duplicates|losses|unexpected|media files|gateway switches|first switch|LOADGEN)(:| ) ' \
    "$LOG_FILE" | sed 's/^/  /'
}

log "$SCENARIO: target $TARGET"

if ! command -v uv >/dev/null 2>&1; then
  log "precondition failed: uv is required to run the load generator"
  exit 2
fi

if ! container_ok "$TARGET"; then
  log "precondition failed: $TARGET is not running"
  exit 2
fi
if ! garage_ok 3; then
  log "precondition failed: Garage does not have 3 healthy nodes"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200"
  exit 2
fi

log "state before:"
print_cluster_state

# The load generator signs in as an administrator to create a researcher. The
# account is fresh for this run, so the generator can enrol its TOTP secret.
printf '%s\n' "$LOADGEN_ADMIN_PASSWORD" |
  compose exec -T api1 python -m app.cli create-admin \
    --email "$LOADGEN_ADMIN_EMAIL" --password-stdin >/dev/null 2>&1 || true

LOADGEN_ARGS=(
  --base "$GATEWAY1" --second-base "$GATEWAY2"
  --admin-email "$LOADGEN_ADMIN_EMAIL" --admin-password "$LOADGEN_ADMIN_PASSWORD"
  --participants "$PARTICIPANTS" --minutes "$MINUTES" --rate "$RATE"
  --media-ratio 1 --seed "$SEED" --media-timeout 300
  --mailpit-url "${FIELDNOTE_LOADGEN_MAILPIT_URL:-http://127.0.0.1:8026}"
)
if [ -n "${FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET:-}" ]; then
  LOADGEN_ARGS+=(--admin-totp-secret "$FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET")
fi

log "starting the load generator ($PARTICIPANTS phones, $MINUTES min, rate $RATE, media)"
(
  cd "$REPO_ROOT/tools/loadgen" || exit 1
  uv run loadgen "${LOADGEN_ARGS[@]}"
) >"$LOG_FILE" 2>&1 &
LOADGEN_PID=$!

loadgen_sending() {
  grep -q 'phones joined' "$LOG_FILE"
}
if ! wait_until 180 1 loadgen_sending; then
  log "the load generator did not start sending; output follows"
  sed 's/^/    /' "$LOG_FILE"
  exit 1
fi
sleep 4

log "injecting: docker kill $TARGET"
kill_ms="$(now_ms)"
crash_stop "$TARGET"
TARGET_DOWN=1
if container_running "$TARGET"; then container_down=0; else container_down=1; fi

# Garage's failure detector keeps the node in the healthy set for about 80 s.
# The load generator is still sending during this wait, so it costs no time.
if wait_until 150 2 garage_ok 2 garage1 garage2 garage3; then
  down_ms=$(( $(now_ms) - kill_ms ))
else
  down_ms=-1
fi
garage_now="$(garage_count garage1 garage2 garage3 2>/dev/null)" || garage_now="?"

# Let the load generator finish with only two healthy storage nodes.
wait_deadline=$(( $(now_ms) + (${MINUTES%.*} * 60 + 600) * 1000 ))
while kill -0 "$LOADGEN_PID" 2>/dev/null; do
  if [ "$(now_ms)" -ge "$wait_deadline" ]; then
    log "the load generator did not finish in time"
    kill "$LOADGEN_PID" 2>/dev/null || true
    break
  fi
  sleep 1
done
LOADGEN_RC=0
wait "$LOADGEN_PID" || LOADGEN_RC=$?
LOADGEN_PID=""

LOSSES="$(summary_value losses)"
DUPLICATES="$(summary_value duplicates)"
UNEXPECTED="$(summary_value unexpected)"
ATTEMPTS="$(summary_value attempts)"
CONFIRMED="$(summary_value confirmed)"
READABLE="$(summary_value 'media files' | awk '{print $1}' | cut -d/ -f1)"
MEDIA_TOTAL="$(summary_value 'media files' | awk '{print $1}' | cut -d/ -f2)"
SWITCHES="$(summary_value 'gateway switches')"

log "measured while $TARGET is down:"
log "  storage node left the healthy set: ${down_ms} ms (healthy nodes now: ${garage_now}/3)"
log "  load generator exit code: ${LOADGEN_RC}"
print_loadgen_summary

# Restore the node and wait until Garage accepts it again.
rejoin_start="$(now_ms)"
log "restarting $TARGET"
crash_start "$TARGET"
TARGET_DOWN=0
if wait_until 180 2 garage_ok 3; then
  rejoin_ms=$(( $(now_ms) - rejoin_start ))
else
  rejoin_ms=-1
fi

log "measured after the node returned:"
log "  Garage healthy nodes: $(garage_count garage1 garage2 garage3 2>/dev/null)/3 after ${rejoin_ms} ms"
log "  entries sent: ${ATTEMPTS:-?}, confirmed: ${CONFIRMED:-?}"
log "  losses: ${LOSSES:-?}, duplicates: ${DUPLICATES:-?}, unexpected: ${UNEXPECTED:-?}"
log "  readable files: ${READABLE:-?}/${MEDIA_TOTAL:-?}"
log "  gateway switches: ${SWITCHES:-?} (both gateways stayed up in this scenario)"

media_ok() {
  [ -n "$MEDIA_TOTAL" ] && [ "${READABLE:-x}" = "$MEDIA_TOTAL" ]
}

[ "$container_down" -eq 1 ] && ok_check "$TARGET is stopped" || fail_check "$TARGET is still running"
[ "$down_ms" -ge 0 ] && ok_check "$TARGET left the healthy set" || fail_check "$TARGET stayed healthy"
[ "$LOADGEN_RC" -ne 2 ] && ok_check "the load generator completed a run" || fail_check "the load generator could not start"
check "no entry was lost" [ "${LOSSES:-unknown}" = "0" ]
check "no entry was duplicated" [ "${DUPLICATES:-unknown}" = "0" ]
check "no unexpected entry appeared" [ "${UNEXPECTED:-unknown}" = "0" ]
check "every uploaded file is readable" media_ok
[ "$rejoin_ms" -ge 0 ] && ok_check "$TARGET rejoined Garage" || fail_check "$TARGET did not rejoin Garage"
check "Garage has 3 healthy nodes again" garage_ok 3

log "state after:"
print_cluster_state

finish
