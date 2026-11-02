#!/usr/bin/env bash
# third_party/rhwp 에 upstream rhwp 기준 커밋을 받고 patches/rhwp/*.patch 를 적용한다.
# rhwp 저장소는 문서·PDF 자료 때문에 수 GB 라 blob 은 필요할 때만 받고 무거운 폴더는 뺀다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RHWP="$ROOT/third_party/rhwp"
BASE=ad4bf269ffef5adf2142b33004a9981fad7ce804
MARKER="단 구분선을 머리 개체 띠 아래에서 시작하고 마지막 글줄에서 멈춘다"

if [ ! -e "$RHWP/Cargo.toml" ]; then
  echo "[rhwp] upstream $BASE 받기"
  rm -rf "$RHWP"
  git clone -c core.autocrlf=false -c core.longpaths=true --filter=blob:none --no-checkout \
    https://github.com/edwardkim/rhwp.git "$RHWP"
  git -C "$RHWP" sparse-checkout set --no-cone '/*' '!/mydocs/' '!/pdf/' \
    '/mydocs/pr/assets/two_column_exam_floats/' '/pdf/two_column_exam_floats/'
  git -C "$RHWP" checkout -q "$BASE"
fi

if ! git -C "$RHWP" log -12 --format=%s | grep -qF "$MARKER"; then
  echo "[rhwp] 패치 적용"
  git -C "$RHWP" checkout -q "$BASE"
  git -C "$RHWP" -c user.name="k-doc" -c user.email="k-doc@localhost" \
    -c core.autocrlf=false am --3way "$ROOT"/patches/rhwp/*.patch
fi
echo "[rhwp] $(git -C "$RHWP" log -1 --format='%h %s')"
