#!/bin/bash
# K-Doc macOS 설치: 최신 버전을 내려받아 응용 프로그램 폴더에 넣고 바로 연다.
set -euo pipefail
REPO="zoo3323/k-doc"
case "$(uname -m)" in
  arm64) ASSET="k-doc-macos-arm64.zip" ;;
  *) ASSET="k-doc-macos-x64.zip" ;;
esac
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "⬇️  K-Doc을 내려받는 중..."
curl -fL --progress-bar -o "$TMP/app.zip" "https://github.com/$REPO/releases/latest/download/$ASSET"
ditto -x -k "$TMP/app.zip" "$TMP"
APP_SRC="$(find "$TMP" -maxdepth 1 -name '*.app' | head -1)"

DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"
rm -rf "$DEST/K-Doc.app"
cp -R "$APP_SRC" "$DEST/"
# 인증서 없는 앱이라 붙는 '확인되지 않은 개발자' 표시를 지운다.
xattr -dr com.apple.quarantine "$DEST/K-Doc.app" 2>/dev/null || true

echo "✅ 설치 완료: $DEST/K-Doc.app"
open "$DEST/K-Doc.app"
