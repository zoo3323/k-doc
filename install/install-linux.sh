#!/bin/bash
# K-Doc Linux 설치: Ubuntu·Debian 계열은 .deb, 그 밖에는 AppImage 와 바로가기를 만든다.
set -euo pipefail
REPO="zoo3323/k-doc"
BASE="https://github.com/$REPO/releases/latest/download"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1; then
  echo "K-Doc(.deb) 내려받는 중..."
  curl -fL --progress-bar -o "$TMP/k-doc.deb" "$BASE/k-doc-linux-x64.deb"
  echo "설치하는 중... (비밀번호를 물으면 입력하세요)"
  sudo apt-get install -y "$TMP/k-doc.deb"
else
  echo "K-Doc(AppImage) 내려받는 중..."
  mkdir -p "$HOME/Applications" "$HOME/.local/share/applications" "$HOME/.local/share/icons"
  curl -fL --progress-bar -o "$HOME/Applications/k-doc.AppImage" "$BASE/k-doc-linux-x64.AppImage"
  chmod +x "$HOME/Applications/k-doc.AppImage"
  curl -fsSL -o "$HOME/.local/share/icons/k-doc.png" \
    "https://raw.githubusercontent.com/$REPO/main/apps/desktop/src-tauri/icons-app/logo-256.png"
  cat > "$HOME/.local/share/applications/k-doc.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=K-Doc
Exec=$HOME/Applications/k-doc.AppImage %f
Icon=$HOME/.local/share/icons/k-doc.png
MimeType=application/x-hwp;application/vnd.hancom.hwpx;
Categories=Office;WordProcessor;
DESKTOP
fi
echo "설치 완료! 프로그램 목록에서 'K-Doc'을 실행하세요."
