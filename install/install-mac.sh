#!/bin/bash
# K-Doc macOS 설치: 최신 버전을 내려받아 응용 프로그램 폴더에 넣고 바로 연다.
# 같은 명령을 다시 실행하면 최신 버전으로 업데이트된다.
set -euo pipefail
REPO="zoo3323/k-doc"

fail() { echo "❌ $1" >&2; exit 1; }

# Rosetta 로 돌아가는 터미널에서도 Apple 칩을 맞게 알아본다.
if [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = "1" ]; then
  ASSET="k-doc-macos-arm64.zip"; CHIP="Apple 칩"
else
  ASSET="k-doc-macos-x64.zip"; CHIP="인텔"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "⬇️  K-Doc($CHIP)을 내려받는 중..."
curl -fL --progress-bar -o "$TMP/app.zip" "https://github.com/$REPO/releases/latest/download/$ASSET" \
  || fail "내려받지 못했습니다. 인터넷 연결을 확인하고 다시 실행해 주세요."
ditto -x -k "$TMP/app.zip" "$TMP" || fail "받은 파일을 풀지 못했습니다. 다시 실행해 주세요."
APP_SRC="$(find "$TMP" -maxdepth 1 -name '*.app' | head -1)"
[ -n "$APP_SRC" ] || fail "받은 파일에 앱이 없습니다. 다시 실행해 주세요."

# 켜져 있으면 닫고 바꾼다.
if pgrep -x hop-desktop >/dev/null 2>&1; then
  osascript -e 'tell application id "io.github.zoo3323.k-doc" to quit' >/dev/null 2>&1 || true
  sleep 2
fi

DEST="/Applications"
if ! { [ -w "$DEST" ] && { [ ! -e "$DEST/K-Doc.app" ] || [ -w "$DEST/K-Doc.app" ]; }; }; then
  DEST="$HOME/Applications"
fi
mkdir -p "$DEST"
rm -rf "$DEST/K-Doc.app"
cp -R "$APP_SRC" "$DEST/" || fail "$DEST 에 넣지 못했습니다."
# 터미널로 받은 앱은 '확인되지 않은 개발자' 표시가 붙지 않지만, 혹시 몰라 지운다.
xattr -dr com.apple.quarantine "$DEST/K-Doc.app" 2>/dev/null || true

echo "✅ 설치 완료: $DEST/K-Doc.app"
open "$DEST/K-Doc.app"
