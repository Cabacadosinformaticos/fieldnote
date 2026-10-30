#!/usr/bin/env bash
# Fault scenario 10: stop gateway 1 while clients are in use. The load generator
# sends through gateway 1 and falls back to gateway 2 when the first one stops.
# Expected: no entry lost or duplicated, the first fallback completes in under 5 s
# (the fault-model target for API traffic), and gateway 1 serves traffic again
# after it starts.
#
# Usage: bash infra/chaos/fs10-stop-gateway.sh

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS10 stop gateway 1 during client traffic"

PARTICIPANTS="${FS10_PARTICIPANTS:-10}"
MINUTES="${FS10_MINUTES:-1}"
RATE="${FS10_RATE:-12}"
SEED="${FS10_SEED:-10}"
SWITCH_TARGET_MS="${FS10_SWITCH_TARGET_MS:-5000}"

LOADGEN_ADMIN_EMAIL="${FIELDNOTE_LOADGEN_ADMIN_EMAIL:-loadgen-fs10-$(date +%s)-$$@fieldnote.test}"
LOADGEN_ADMIN_PASSWORD="${FIELDNOTE_LOADGEN_ADMIN_PASSWORD:-LoadgenCluster!2026}"
LOG_FILE="$(mktemp -t fieldnote-fs10-XXXXXX.log)"
GATEWAY_STOPPED=0
LOADGEN_PID=""

restore() {
  if [ -n "$LOADGEN_PID" ] && kill -0 "$LOADGEN_PID" 2>/dev/null; then
    kill "$LOADGEN_PID" 2>/dev/null || true
    wait "$LOADGEN_PID" 2>/dev/null || true
    LOADGEN_PID=""
  fi
  if [ "$GATEWAY_STOPPED" -eq 1 ]; then
    log "restoring gateway 1"
    compose start traefik1 >/dev/null 2>&1 || docker start traefik1 >/dev/null 2>&1 || true
    GATEWAY_STOPPED=0
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

gateway1_down() {
  [ "$(gateway_status "$GATEWAY1")" = "0" ]
}

log "$SCENARIO"

if ! command -v uv >/dev/null 2>&1; then
  log "precondition failed: uv is required to run the load generator"
  exit 2
fi

if ! container_ok traefik1; then
  log "precondition failed: traefik1 is not running"
  exit 2
fi
if ! api_health "$GATEWAY1" || ! api_health "$GATEWAY2"; then
  log "precondition failed: both gateways must answer HTTP 200"
  exit 2
fi

log "state before:"
print_cluster_state

printf '%s\n' "$LOADGEN_ADMIN_PASSWORD" |
  compose exec -T api1 python -m app.cli create-admin \
    --email "$LOADGEN_ADMIN_EMAIL" --password-stdin >/dev/null 2>&1 || true

# A share of entries carry a photo: the APIs reach object storage through the
# s3-gateway alias that both gateways answer to, so uploads survive gateway 1.
LOADGEN_ARGS=(
  --base "$GATEWAY1" --second-base "$GATEWAY2"
  --admin-email "$LOADGEN_ADMIN_EMAIL" --admin-password "$LOADGEN_ADMIN_PASSWORD"
  --participants "$PARTICIPANTS" --minutes "$MINUTES" --rate "$RATE"
  --media-ratio "${MEDIA_RATIO:-0.3}" --seed "$SEED" --media-timeout 300
)
if [ -n "${FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET:-}" ]; then
  LOADGEN_ARGS+=(--admin-totp-secret "$FIELDNOTE_LOADGEN_ADMIN_TOTP_SECRET")
fi

log "starting the load generator through gateway 1 ($PARTICIPANTS phones, $MINUTES min, rate $RATE)"
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
# Let every simulated phone send at least one entry through gateway 1.
sleep 6

log "injecting: docker compose stop traefik1"
stop_ms="$(now_ms)"
compose stop -t 5 traefik1 >/dev/null 2>&1
GATEWAY_STOPPED=1

if wait_until 15 1 gateway1_down; then
  down_ms=$(( $(now_ms) - stop_ms ))
else
  down_ms=-1
fi

# Let the load generator finish through the fallback gateway.
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

ATTEMPTS="$(summary_value attempts)"
CONFIRMED="$(summary_value confirmed)"
LOSSES="$(summary_value losses)"
DUPLICATES="$(summary_value duplicates)"
UNEXPECTED="$(summary_value unexpected)"
SWITCHES="$(summary_value 'gateway switches')"
FIRST_SWITCH="$(summary_value 'first switch')"
FIRST_SWITCH_MS="$(printf '%s' "$FIRST_SWITCH" | awk '{print ($1 == "none" || $1 == "" ? -1 : int($1))}')"
MEDIA_LINE="$(summary_value 'media files')"

log "measured while gateway 1 was stopped:"
log "  gateway 1 stopped answering after ${down_ms} ms"
log "  load generator exit code: ${LOADGEN_RC}"
log "  gateway switches: ${SWITCHES:-?}, first switch: ${FIRST_SWITCH:-?}"
print_loadgen_summary

restart_start="$(now_ms)"
log "restarting gateway 1"
compose start traefik1 >/dev/null 2>&1
GATEWAY_STOPPED=0
if stable_gateway "$GATEWAY1" 3 20; then
  gateway_back_ms=$(( $(now_ms) - restart_start ))
  gateway1_ok=0
else
  gateway_back_ms=-1
  gateway1_ok=1
fi

log "measured after gateway 1 returned:"
log "  gateway 1 healthy again after ${gateway_back_ms} ms"
log "  entries sent: ${ATTEMPTS:-?}, confirmed: ${CONFIRMED:-?}"
log "  losses: ${LOSSES:-?}, duplicates: ${DUPLICATES:-?}, unexpected: ${UNEXPECTED:-?}"
log "  media: ${MEDIA_LINE:-?}"
log "  gateway 1 HTTP status: $(gateway_status "$GATEWAY1")"

[ "$down_ms" -ge 0 ] && ok_check "gateway 1 stopped answering" || fail_check "gateway 1 kept answering"
[ "$LOADGEN_RC" -ne 2 ] && ok_check "the load generator completed a run" || fail_check "the load generator could not start"
check "no entry was lost" [ "${LOSSES:-unknown}" = "0" ]
check "no entry was duplicated" [ "${DUPLICATES:-unknown}" = "0" ]
check "no unexpected entry appeared" [ "${UNEXPECTED:-unknown}" = "0" ]
[ "${SWITCHES:-0}" -ge 1 ] && ok_check "the client used the fallback gateway" || fail_check "the client never switched"
if [ "$FIRST_SWITCH_MS" -ge 0 ] && [ "$FIRST_SWITCH_MS" -le "$SWITCH_TARGET_MS" ]; then
  ok_check "the first switch took ${FIRST_SWITCH_MS} ms (target <= ${SWITCH_TARGET_MS} ms)"
else
  fail_check "the first switch took ${FIRST_SWITCH_MS} ms (target <= ${SWITCH_TARGET_MS} ms)"
fi
[ "$gateway1_ok" -eq 0 ] && ok_check "gateway 1 answers HTTP 200 again" || fail_check "gateway 1 did not recover"

log "state after:"
print_cluster_state

finish
