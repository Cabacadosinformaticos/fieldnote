#!/usr/bin/env bash
# Fault scenario 8: the phone records 3 entries while it has no network.
#
# The script turns Wi-Fi and mobile data off on the running Android emulator,
# waits while the operator records 3 entries in the app, turns the network back
# on, and then reads the study's entries through the API. Expected: exactly 3
# new entries arrive, once each, after the network returns.
#
# A researcher token is needed to read the study through the API:
#
#   FIELDNOTE_RESEARCHER_TOKEN=<bearer token> \
#     bash infra/chaos/fs8-airplane-mode.sh <study_id> [--auto] [--delay <seconds>]
#
# --auto does not prompt; it waits --delay seconds (default 45) before restoring
# the network. It still requires the 3 entries to appear, so a rehearsal without
# an operator will fail the count check.
#
# Environment: FIELDNOTE_BASE_URL (default http://127.0.0.1:8090),
# ANDROID_SERIAL when more than one adb device is attached, ADB to override the
# adb binary, FS8_FLUSH_TIMEOUT (default 90) to wait for the queued entries.

. "$(cd "$(dirname "$0")" && pwd)/lib.sh"

SCENARIO="FS8 airplane mode during 3 entries"

BASE="${FIELDNOTE_BASE_URL:-http://127.0.0.1:8090}"
TOKEN="${FIELDNOTE_RESEARCHER_TOKEN:-${FIELDNOTE_API_TOKEN:-}}"
FLUSH_TIMEOUT="${FS8_FLUSH_TIMEOUT:-90}"
AUTO_SECONDS="${FS8_AUTO_SECONDS:-45}"
AUTO=0
STUDY_ID=""
NETWORK_OFF=0
WORK_DIR=""
ADB_BIN="${ADB:-adb}"
ADB=()

usage() {
  printf 'usage: bash %s <study_id> [--auto] [--delay <seconds>]\n' "$0" >&2
}

restore() {
  if [ "$NETWORK_OFF" -eq 1 ]; then
    log "restoring the phone network"
    "${ADB[@]}" shell svc wifi enable >/dev/null 2>&1 || true
    "${ADB[@]}" shell svc data enable >/dev/null 2>&1 || true
    NETWORK_OFF=0
  fi
  [ -n "$WORK_DIR" ] && rm -rf "$WORK_DIR"
}

# Prints every entry id of the study, following next_cursor to the last page.
entry_ids() {
  "$PYTHON" - "$BASE" "$STUDY_ID" "$TOKEN" <<'PY'
import json
import sys
import urllib.parse
import urllib.request

base, study, token = sys.argv[1:4]
ids: list[str] = []
cursor = None
while True:
    params = {"limit": 200}
    if cursor:
        params["cursor"] = cursor
    url = f"{base.rstrip('/')}/api/v1/studies/{study}/entries?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=15) as response:
        page = json.load(response)
    ids.extend(item["id"] for item in page["items"])
    cursor = page.get("next_cursor")
    if not cursor:
        break
print("\n".join(ids))
PY
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --auto) AUTO=1 ;;
    --delay)
      shift
      AUTO_SECONDS="${1:-}"
      ;;
    --delay=*) AUTO_SECONDS="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    -*) usage; exit 2 ;;
    *)
      if [ -n "$STUDY_ID" ]; then
        usage
        exit 2
      fi
      STUDY_ID="$1"
      ;;
  esac
  shift
done

if [ -z "$STUDY_ID" ]; then
  usage
  exit 2
fi
case "$AUTO_SECONDS" in
  ''|*[!0-9]*) log "--delay needs a whole number of seconds"; exit 2 ;;
esac

log "$SCENARIO: study $STUDY_ID"

if ! command -v "$ADB_BIN" >/dev/null 2>&1; then
  log "precondition failed: adb is not on PATH; install the Android platform tools or set ADB"
  exit 2
fi
if [ -z "$TOKEN" ]; then
  log "precondition failed: set FIELDNOTE_RESEARCHER_TOKEN to a researcher bearer token"
  exit 2
fi

SERIAL="${ANDROID_SERIAL:-}"
if [ -z "$SERIAL" ]; then
  devices="$("$ADB_BIN" devices | awk 'NR > 1 && $2 == "device" { print $1 }')"
  count="$(printf '%s\n' "$devices" | grep -c . || true)"
  case "$count" in
    0)
      log "precondition failed: adb sees no running device or emulator"
      exit 2
      ;;
    1) SERIAL="$devices" ;;
    *)
      log "precondition failed: more than one adb device; set ANDROID_SERIAL"
      printf '%s\n' "$devices" | sed 's/^/  /' >&2
      exit 2
      ;;
  esac
fi
ADB=("$ADB_BIN" -s "$SERIAL")
if [ "$("${ADB[@]}" get-state 2>/dev/null | tr -d '\r')" != "device" ]; then
  log "precondition failed: $SERIAL is not ready"
  exit 2
fi

WORK_DIR="$(mktemp -d -t fieldnote-fs8-XXXXXX)"
before_ids="$(entry_ids)" || {
  log "precondition failed: could not read the study's entries through $BASE"
  exit 2
}
printf '%s\n' "$before_ids" | grep . | sort -u >"$WORK_DIR/before"
before_count="$(grep -c . "$WORK_DIR/before" || true)"

log "state before:"
log "  device: $SERIAL"
log "  entries in the study: $before_count"
log "  app network check: $(api_health "$BASE" && echo "API reachable from the host" || echo "API unreachable from the host")"

log "injecting: Wi-Fi and mobile data off on $SERIAL"
if ! "${ADB[@]}" shell svc wifi disable >/dev/null 2>&1; then
  log "could not turn Wi-Fi off"
  exit 1
fi
if ! "${ADB[@]}" shell svc data disable >/dev/null 2>&1; then
  log "could not turn mobile data off"
  "${ADB[@]}" shell svc wifi enable >/dev/null 2>&1 || true
  exit 1
fi
NETWORK_OFF=1
log "  network disabled on $SERIAL"

if [ "$AUTO" -eq 1 ]; then
  log "waiting $AUTO_SECONDS s (--auto): record 3 entries in the app now"
  sleep "$AUTO_SECONDS"
else
  printf '%s\n' "Record 3 entries in the app while the phone is offline, then press Enter."
  if ! read -r; then
    log "standard input is not interactive; use --auto"
    exit 1
  fi
fi

log "restoring: Wi-Fi and mobile data on"
"${ADB[@]}" shell svc wifi enable >/dev/null 2>&1 || true
"${ADB[@]}" shell svc data enable >/dev/null 2>&1 || true
NETWORK_OFF=0
sleep 2

# Wait for the app to flush its queue, then count the entries that arrived.
deadline=$(( $(now_ms) + FLUSH_TIMEOUT * 1000 ))
after_ids=""
new_count=0
while :; do
  if ! after_ids="$(entry_ids)"; then
    log "could not read the entries through $BASE; retrying"
  else
    printf '%s\n' "$after_ids" | grep . | sort -u >"$WORK_DIR/after"
    new_count="$(comm -13 "$WORK_DIR/before" "$WORK_DIR/after" | grep -c . || true)"
    [ "$new_count" -ge 3 ] && break
  fi
  if [ "$(now_ms)" -ge "$deadline" ]; then
    break
  fi
  sleep 2
done

printf '%s\n' "$after_ids" | grep . | sort -u >"$WORK_DIR/after"
after_count="$(grep -c . "$WORK_DIR/after" || true)"
new_count="$(comm -13 "$WORK_DIR/before" "$WORK_DIR/after" | grep -c . || true)"
added=$(( after_count - before_count ))

log "state after:"
log "  entries in the study: $after_count (added $added)"
log "  new entry ids: $new_count"
if [ "$new_count" -gt 0 ]; then
  comm -13 "$WORK_DIR/before" "$WORK_DIR/after" | sed 's/^/    /'
fi
log "  device: $SERIAL"

check "the 3 offline entries arrived" [ "$new_count" -eq 3 ]
check "the count grew by exactly 3" [ "$added" -eq 3 ]

log "state after recovery:"
log "  gateway $BASE health: HTTP $(gateway_status "$BASE")"

finish
