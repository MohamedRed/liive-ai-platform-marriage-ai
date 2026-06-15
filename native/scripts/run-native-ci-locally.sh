#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ROOT_DIR/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"

cd "$REPO_DIR"

export ANDROID_HOME="${ANDROID_HOME:-/home/hermes/android-sdk}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"

section() {
  printf '\n==> %s\n' "$*"
}

section "Validate native project skeleton and safety gates"
python3 native/validate_native_projects.py

section "Check Swift/Kotlin file size gate"
python3 - <<'PY'
from pathlib import Path
bad=[]
for p in Path('native').rglob('*'):
    if p.is_file() and p.suffix in {'.kt', '.swift'}:
        n=sum(1 for _ in p.open(encoding='utf-8'))
        if n >= 290:
            bad.append((n, p))
if bad:
    for n, p in bad:
        print(f'{n} {p}')
    raise SystemExit(1)
print('Swift/Kotlin files < 290 lines')
PY

section "Validate iOS AppIcon catalog JSON"
python3 -m json.tool native/ios/JustMarriage/Assets.xcassets/AppIcon.appiconset/Contents.json >/dev/null

section "Android Gradle wrapper version"
(
  cd "$ANDROID_DIR"
  ./gradlew --version --no-daemon
)

section "Build Android debug APK"
(
  cd "$ANDROID_DIR"
  ./gradlew assembleDebug --no-daemon
)

section "Check whitespace"
git diff --check

if command -v xcodegen >/dev/null 2>&1 && command -v xcodebuild >/dev/null 2>&1; then
  section "Generate and build iOS project"
  (
    cd "$ROOT_DIR/ios"
    xcodegen generate
    xcodebuild \
      -project JustMarriage.xcodeproj \
      -scheme JustMarriage \
      -destination 'generic/platform=iOS Simulator' \
      CODE_SIGNING_ALLOWED=NO \
      build
  )
else
  section "Skipping iOS xcodebuild"
  printf 'xcodegen/xcodebuild are unavailable on this machine. Run this script on macOS to execute the iOS build gate.\n'
fi

section "Native local CI completed"
printf 'APK: %s\n' "$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
