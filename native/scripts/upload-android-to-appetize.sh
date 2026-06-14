#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"
APK_PATH="${APK_PATH:-$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk}"
API_HOST="${APPETIZE_API_HOST:-https://api.appetize.io}"
PLATFORM="${APPETIZE_PLATFORM:-android}"
FILE_TYPE="${APPETIZE_FILE_TYPE:-apk}"
TIMEOUT_SECONDS="${APPETIZE_TIMEOUT:-120}"
NOTE="${APPETIZE_NOTE:-Just Marriage native Android debug build from $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo local)}"

if [ -z "${APPETIZE_API_TOKEN:-}" ]; then
  cat >&2 <<'MSG'
APPETIZE_API_TOKEN is required and was not found in the environment.
Set it locally or in GitHub Actions secrets before uploading.
No upload was attempted.
MSG
  exit 2
fi

if [ ! -f "$APK_PATH" ]; then
  cat >&2 <<MSG
APK not found: $APK_PATH
Run native/scripts/run-native-ci-locally.sh first, or set APK_PATH to an existing .apk.
MSG
  exit 3
fi

URL="$API_HOST/v1/apps/"
if [ -n "${APPETIZE_PUBLIC_KEY:-}" ]; then
  URL="$URL$APPETIZE_PUBLIC_KEY"
fi

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

curl --fail --silent --show-error \
  --user "$APPETIZE_API_TOKEN:" \
  --form "file=@${APK_PATH}" \
  --form "platform=${PLATFORM}" \
  --form "fileType=${FILE_TYPE}" \
  --form "timeout=${TIMEOUT_SECONDS}" \
  --form "note=${NOTE}" \
  "$URL" > "$TMP_JSON"

python3 - <<'PY' "$TMP_JSON"
import json, sys
path = sys.argv[1]
data = json.load(open(path))
public_key = data.get('publicKey') or data.get('public_key')
if not public_key:
    print(json.dumps(data, indent=2))
    raise SystemExit('Appetize upload response did not include publicKey')
print(f'APPETIZE_PUBLIC_KEY={public_key}')
print(f'APPETIZE_URL=https://appetize.io/app/{public_key}')
PY
