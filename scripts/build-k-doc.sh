#!/usr/bin/env bash
# K-Doc 데스크톱 앱을 이 컴퓨터에서 빌드한다(macOS·Linux).
#
# 1. scripts/prepare-rhwp.sh 로 upstream rhwp 를 받고 패치를 적용한다.
# 2. 패치한 rhwp 로 WASM 을 빌드해 rhwp pkg/ 와 studio-host vendor 에 넣는다.
# 3. pnpm 의존성을 설치하고 Tauri 로 앱을 만든다.
#
# 필요: rustup(+ wasm32-unknown-unknown), wasm-pack 0.15, Node 22+, pnpm 10(없으면 npx 사용)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RHWP="$ROOT/third_party/rhwp"

"$ROOT/scripts/prepare-rhwp.sh"

echo "[wasm] rhwp WASM 빌드"
(cd "$RHWP" && scripts/wasm-pack-locked.sh --target web --out-dir pkg)
VENDOR="$ROOT/apps/studio-host/vendor/rhwp-core"
for f in rhwp.js rhwp_bg.wasm rhwp.d.ts rhwp_bg.wasm.d.ts package.json; do
  cp "$RHWP/pkg/$f" "$VENDOR/$f"
done

echo "[app] 앱 빌드"
cd "$ROOT"
# tauri.conf.json 의 beforeBuildCommand 가 pnpm 을 부르므로 없으면 임시 shim 을 PATH 에 둔다.
if ! command -v pnpm >/dev/null 2>&1; then
  SHIM="$(mktemp -d)"
  printf '#!/bin/sh\nexec npx -y pnpm@10.33.0 "$@"\n' > "$SHIM/pnpm"
  chmod +x "$SHIM/pnpm"
  export PATH="$SHIM:$PATH"
fi
pnpm install --frozen-lockfile
pnpm --filter hop-desktop tauri build "$@"
echo "완료: apps/desktop/src-tauri/target/release/bundle/"
