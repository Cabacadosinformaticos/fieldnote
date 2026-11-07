#!/usr/bin/env bash
# End-to-end smoke test for the development stack: admin, study, participant,
# signed upload, media processing and researcher read.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BASE_URL="${FIELDNOTE_BASE_URL:-http://127.0.0.1:8080}"
ADMIN_PASSWORD="${FIELDNOTE_SMOKE_PASSWORD:-SmokeTest!2026}"
ADMIN_EMAIL="smoke-admin-$(date +%s)@fieldnote.test"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

# A 32x32 red JPEG, generated with ffmpeg, small enough to keep in the script.
JPEG_BASE64='/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMAD/2wBDAAgEBAQEBAUFBQUFBQYGBgYGBgYGBgYGBgYHBwcICAgHBwcGBgcHCAgICAkJCQgICAgJCQoKCgwMCwsODg4RERT/xABNAAEBAAAAAAAAAAAAAAAAAAAABgEBAQEAAAAAAAAAAAAAAAAAAAYHEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAIAAgAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8AiwEm38AAAAAB/9k='

compose() { docker compose --profile dev "$@"; }

step() { printf '\n==> %s\n' "$*"; }

fail() {
    printf 'FAILED: %s\n' "$*" >&2
    exit 1
}

request() {
    local method="$1" path="$2" body="${3:-}" authorization="${4:-}"
    local args=(-sS -X "$method" "$BASE_URL$path" -H 'Content-Type: application/json')
    if [ -n "$authorization" ]; then
        args+=(-H "Authorization: $authorization")
    fi
    if [ -n "$body" ]; then
        args+=(--data-binary "$body")
    fi
    local response
    response="$(curl "${args[@]}")" || fail "curl $method $path failed"
    if printf '%s' "$response" | jq -e '.error' >/dev/null 2>&1; then
        fail "API error on $method $path: $response"
    fi
    printf '%s' "$response"
}

non_empty() {
    [ -n "$1" ] && [ "$1" != "null" ]
}

step "Checking the API through the gateway at $BASE_URL"
request GET /api/v1/health | jq -e '.status == "ok"' >/dev/null || fail "the API is not healthy"

step "Creating administrator $ADMIN_EMAIL with the API CLI"
printf '%s\n' "$ADMIN_PASSWORD" |
    compose exec -T api python -m app.cli create-admin \
        --email "$ADMIN_EMAIL" --password-stdin

step "Enrolling TOTP and signing in"
enrolment="$(request POST /api/v1/auth/totp/enrolment \
    "$(jq -n --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
        '{email: $email, password: $password}')")"
TOTP_SECRET="$(printf '%s' "$enrolment" | jq -r '.secret')"
non_empty "$TOTP_SECRET" || fail "TOTP enrolment did not return a secret"

TOTP_CODE="$(compose exec -T api python -c \
    'import sys; from app.security import totp; print(totp.generate_code(sys.argv[1]))' \
    "$TOTP_SECRET" | tr -d '\r\n')"
non_empty "$TOTP_CODE" || fail "could not generate a TOTP code"

request POST /api/v1/auth/totp/enrolment/confirm \
    "$(jq -n --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
        --arg code "$TOTP_CODE" \
        '{email: $email, password: $password, totp_code: $code}')" >/dev/null

login="$(request POST /api/v1/auth/login \
    "$(jq -n --arg email "$ADMIN_EMAIL" --arg password "$ADMIN_PASSWORD" \
        --arg code "$TOTP_CODE" \
        '{email: $email, password: $password, totp_code: $code}')")"
ACCESS_TOKEN="$(printf '%s' "$login" | jq -r '.access_token')"
non_empty "$ACCESS_TOKEN" || fail "login did not return an access token"

step "Creating a study, an activity and a participant"
study="$(request POST /api/v1/studies \
    '{"title":"Smoke study","description":"End-to-end smoke test","timezone":"Europe/Lisbon","max_prompts_per_day":4,"max_prompts_per_slot":2,"schedule_style":"fixed"}' \
    "Bearer $ACCESS_TOKEN")"
STUDY_ID="$(printf '%s' "$study" | jq -r '.id')"
non_empty "$STUDY_ID" || fail "the study was not created"

activity="$(request POST "/api/v1/studies/$STUDY_ID/activities" \
    '{"title":"Smoke photo","instructions":"Take a photo.","entry_types":["photo"],"prompts_per_day":1,"window_start":"00:00:00","window_end":"23:59:59","min_gap_minutes":0,"capture_location":false,"allow_free_entries":true,"max_free_entries_per_day":5,"expected_minutes":1}' \
    "Bearer $ACCESS_TOKEN")"
ACTIVITY_ID="$(printf '%s' "$activity" | jq -r '.id')"
non_empty "$ACTIVITY_ID" || fail "the activity was not created"

participant="$(request POST "/api/v1/studies/$STUDY_ID/participants" \
    '{"alias":"Smoke participant"}' "Bearer $ACCESS_TOKEN")"
PARTICIPANT_ID="$(printf '%s' "$participant" | jq -r '.id')"
PERSONAL_CODE="$(printf '%s' "$participant" | jq -r '.invite_code.code')"
non_empty "$PARTICIPANT_ID" || fail "the participant was not created"
non_empty "$PERSONAL_CODE" || fail "no personal code was issued"

step "Joining with the personal code as the app does"
lookup="$(request POST /api/v1/participation/invitations/lookup \
    "$(jq -n --arg code "$PERSONAL_CODE" '{code: $code}')")"
CONSENT_VERSION="$(printf '%s' "$lookup" | jq -r '.consent_version')"
non_empty "$CONSENT_VERSION" || fail "the invitation lookup did not return a consent version"

acceptance="$(request POST /api/v1/participation/invitations/accept \
    "$(jq -n --arg code "$PERSONAL_CODE" --arg consent "$CONSENT_VERSION" \
        '{code: $code, locale: "pt", consent_version: $consent, answers: []}')")"
OUTCOME="$(printf '%s' "$acceptance" | jq -r '.outcome')"
DEVICE_TOKEN="$(printf '%s' "$acceptance" | jq -r '.device_token')"
case "$OUTCOME" in
    joined | returned | already_participating) ;;
    *) fail "unexpected join outcome: $OUTCOME" ;;
esac
non_empty "$DEVICE_TOKEN" || fail "accepting the code did not return a device token"

step "Requesting a signed upload URL"
ENTRY_ID="$(python -c 'import uuid; print(uuid.uuid4())')"
printf '%s' "$JPEG_BASE64" | base64 -d >"$WORK_DIR/photo.jpg"
SIZE_BYTES="$(wc -c <"$WORK_DIR/photo.jpg" | tr -d '[:space:]')"
SHA256="$(sha256sum "$WORK_DIR/photo.jpg" | awk '{print $1}')"
non_empty "$SHA256" || fail "could not hash the JPEG"

upload="$(request POST /api/v1/media/upload-url \
    "$(jq -n --arg entry_id "$ENTRY_ID" --argjson size_bytes "$SIZE_BYTES" \
        --arg sha256 "$SHA256" \
        '{entry_id: $entry_id, mime_type: "image/jpeg", size_bytes: $size_bytes, sha256: $sha256}')" \
    "Device $DEVICE_TOKEN")"
MEDIA_ID="$(printf '%s' "$upload" | jq -r '.media_object_id')"
UPLOAD_URL="$(printf '%s' "$upload" | jq -r '.upload_url')"
non_empty "$MEDIA_ID" || fail "no media object was created"
non_empty "$UPLOAD_URL" || fail "no upload URL was returned"

# The URL is signed for the origin phones use (10.0.2.2); from the host we
# connect to 127.0.0.1 and keep the original Host header so the signature holds.
UPLOAD_AUTHORITY="${UPLOAD_URL#*://}"
UPLOAD_AUTHORITY="${UPLOAD_AUTHORITY%%/*}"
UPLOAD_PORT="${UPLOAD_AUTHORITY##*:}"
if [ "$UPLOAD_PORT" = "$UPLOAD_AUTHORITY" ]; then
    UPLOAD_PORT=80
fi
UPLOAD_PATH="${UPLOAD_URL#*://${UPLOAD_AUTHORITY}}"
UPLOAD_TARGET="http://127.0.0.1:${UPLOAD_PORT}${UPLOAD_PATH}"

step "Uploading the JPEG through the gateway"
HTTP_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT \
    -H "Host: $UPLOAD_AUTHORITY" \
    -H "Content-Type: image/jpeg" \
    --data-binary "@$WORK_DIR/photo.jpg" \
    "$UPLOAD_TARGET")"
[ "$HTTP_STATUS" = "200" ] || fail "the upload answered HTTP $HTTP_STATUS"
printf 'Uploaded %s bytes\n' "$SIZE_BYTES"

step "Submitting the photo entry"
RECORDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
submission="$(request POST /api/v1/entries \
    "$(jq -n --arg id "$ENTRY_ID" --arg activity_id "$ACTIVITY_ID" \
        --arg content_sha256 "$SHA256" --arg recorded_at "$RECORDED_AT" \
        --arg media_id "$MEDIA_ID" \
        '{id: $id, activity_id: $activity_id, entry_type: "photo", content_sha256: $content_sha256, recorded_at: $recorded_at, media_object_ids: [$media_id]}')" \
    "Device $DEVICE_TOKEN")"
non_empty "$(printf '%s' "$submission" | jq -r '.id')" || fail "the entry was not accepted"

step "Waiting for the media worker to process the photo"
MEDIA_STATUS=""
for _ in $(seq 1 60); do
    MEDIA_STATUS="$(compose exec -T api python -c \
        "import uuid; from app.db import SessionLocal; from app.models import MediaObject; s = SessionLocal(); media = s.get(MediaObject, uuid.UUID('$MEDIA_ID')); print(media.status if media else 'missing'); s.close()" \
        2>/dev/null | tr -d '\r\n')" || MEDIA_STATUS=""
    [ "$MEDIA_STATUS" = "processed" ] && break
    sleep 2
done
[ "$MEDIA_STATUS" = "processed" ] ||
    fail "media object $MEDIA_ID is '$MEDIA_STATUS', not 'processed'"
printf 'media_object.status = processed\n'

step "Checking that the researcher sees the entry"
entries="$(request GET "/api/v1/studies/$STUDY_ID/entries?limit=50" "" "Bearer $ACCESS_TOKEN")"
FOUND="$(printf '%s' "$entries" |
    jq -r --arg id "$ENTRY_ID" '[.items[] | select(.id == $id)] | length')"
[ "$FOUND" = "1" ] || fail "the researcher does not see entry $ENTRY_ID"
SEEN_MEDIA_STATUS="$(printf '%s' "$entries" |
    jq -r --arg id "$ENTRY_ID" '.items[] | select(.id == $id) | .media[0].status')"
[ "$SEEN_MEDIA_STATUS" = "processed" ] ||
    fail "the researcher sees media status '$SEEN_MEDIA_STATUS'"
printf 'Researcher sees entry %s with a processed photo\n' "$ENTRY_ID"

printf '\nSMOKE OK\n'
