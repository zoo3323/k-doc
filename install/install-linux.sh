#!/bin/bash
# 한글 편집기 Linux 설치: Ubuntu·Debian 계열은 .deb, 그 밖에는 AppImage 와 바로가기를 만든다.
set -euo pipefail
REPO="zoo3323/hangul-editor"
BASE="https://github.com/$REPO/releases/latest/download"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then
  echo "⬇️  한글 편집기(.deb)를 내려받는 중..."
  curl -fL --progress-bar -o "$TMP/hangul-editor.deb" "$BASE/hangul-editor-linux-x64.deb"
  echo "📦 설치하는 중... (비밀번호를 물으면 입력하세요)"
  sudo apt-get install -y "$TMP/hangul-editor.deb"
else
  echo "⬇️  한글 편집기(AppImage)를 내려받는 중..."
  mkdir -p "$HOME/Applications" "$HOME/.local/share/applications" "$HOME/.local/share/icons"
  curl -fL --progress-bar -o "$HOME/Applications/hangul-editor.AppImage" "$BASE/hangul-editor-linux-x64.AppImage"
  chmod +x "$HOME/Applications/hangul-editor.AppImage"
  curl -fsSL -o "$HOME/.local/share/icons/hangul-editor.png" \
    "https://raw.githubusercontent.com/$REPO/main/apps/desktop/src-tauri/icons-hangul/logo-256.png"
  cat > "$HOME/.local/share/applications/hangul-editor.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=한글 편집기
Exec=$HOME/Applications/hangul-editor.AppImage %f
Icon=$HOME/.local/share/icons/hangul-editor.png
MimeType=application/x-hwp;application/vnd.hancom.hwpx;
Categories=Office;WordProcessor;
DESKTOP
fi
echo "✅ 설치 완료! 프로그램 목록에서 '한글 편집기'를 실행하세요."
