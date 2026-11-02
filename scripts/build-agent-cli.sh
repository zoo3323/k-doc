#!/usr/bin/env bash
# K-Doc 화면 엔진과 같은 rhwp 트리(upstream 기준 커밋 + patches/rhwp)로 에이전트 도구를 빌드해
# Tauri sidecar 자리(apps/desktop/src-tauri/binaries/k-doc-agent-<target>)에 둔다.
# 사용: scripts/build-agent-cli.sh <target-triple>
# 로컬 맥에서는 돌리지 않는다(메모리 부족). CI(check·release)에서 돈다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:?target triple 이 필요합니다 (예: aarch64-apple-darwin)}"

"$ROOT/scripts/prepare-rhwp.sh"

cd "$ROOT/third_party/rhwp"
cargo build --release --locked --bin rhwp --target "$TARGET"

EXT=""
case "$TARGET" in *windows*) EXT=".exe" ;; esac
OUT="$ROOT/apps/desktop/src-tauri/binaries"
mkdir -p "$OUT"
cp "target/$TARGET/release/rhwp$EXT" "$OUT/k-doc-agent-$TARGET$EXT"
echo "[k-doc-agent] $OUT/k-doc-agent-$TARGET$EXT ($(git log -1 --format='%h %s'))"
