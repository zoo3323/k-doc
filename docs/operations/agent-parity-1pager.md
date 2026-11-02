# 에이전트 화면 일치·파일 경유 공동 편집 1-Pager (1단계)

## Background

2026-11-02 사용자 결정: K-Doc 은 에이전트(Claude Code 등)가 쓰기 쉬워야 하고, 에이전트가 보고 고친 결과가
사람이 K-Doc 에서 보는 것과 똑같이 나와야 한다. 사람 편집은 한글 기본 기능을 모두 갖춘다(2단계).
공동 편집은 파일 경유부터 시작한다(실시간은 3단계).

지금 에이전트는 따로 깐 upstream `rhwp` CLI(v0.8.7, `rhwp mcp-serve`)를 쓴다. K-Doc 엔진은
upstream `ad4bf269`(0.9.0) + `patches/rhwp` 10개다.

## Problem

1. **엔진이 다르다.** 에이전트 CLI 는 버전도 패치도 달라 2단 시험지처럼 패치가 고친 문서는 쪽 배치가 다르다.
2. **글꼴 해석이 다르다.** native CLI 는 내보낼 때 시스템·`ttfs`·`--font-path` 를 훑어 대체 글꼴을 자동으로 고른다
   (`src/cli/outputs/mod.rs` `apply_font_environment`). studio 는 host 글꼴 제공자가 있으면 자동 선택을 끈다.
   같은 문서라도 글자 폭이 달라질 수 있다.
3. **화면은 브라우저 측정 폭을 덧댄다.** canvas2d 의 `CanvasMetricSession` 이 `measureText` 폭을 보충 메트릭으로 쓴다.
   SVG/PDF 내보내기는 `withPortableMetrics` 로 이를 끈다. 화면과 내보내기가 1px 단위로 다를 수 있다.
4. **K-Doc 은 파일이 밖에서 바뀌어도 모른다.** 외부 변경 확인(`check_external_modification`)은 저장할 때만 돈다.
   에이전트가 파일을 고쳐도 사람 화면은 옛 내용 그대로다.

## Goal

- 에이전트 도구와 K-Doc 화면이 **같은 엔진 커밋·같은 패치·같은 글꼴 규칙**을 쓴다.
- 에이전트가 파일을 고치면 K-Doc 이 알아서 다시 불러온다. 사람이 고치던 중이면 덮어쓰지 않고 알린다.
- "에이전트가 렌더한 쪽 = K-Doc 이 그린 쪽"을 CI 테스트가 지킨다.

## Non-goals

- 실시간 공동 편집(같은 세션·같은 실행 취소)은 3단계.
- 한글 기능 빈칸(수식·셀 안 그림·쪽 번호 등)은 2단계.
- 한컴 독점 글꼴을 번들하지 않는다.

## Constraints

- `third_party/rhwp` 는 직접 고치지 않는다. 엔진 수정은 `patches/rhwp/` 로만.
- macOS·Windows·Linux 같은 동작.
- **로컬 Rust/WASM/Tauri 빌드 금지**(사용자 맥이 멈춘다). 컴파일·테스트는 GitHub Actions 에서 돈다.

## Implementation outline (작은 조각 순서)

1. **CI 검사 워크플로**: 브랜치 push 때 `test:upstream`, `test:studio`, `test:desktop`, clippy 를 macOS runner 에서 돌린다.
   이후 조각은 모두 이 검사로 확인한다.
2. **파일 바뀜 자동 반영**: 열린 문서마다 가벼운 확인(크기·수정 시각이 바뀔 때만 내용 해시)을 1초 간격으로 한다.
   - 고친 내용이 없으면 같은 쪽 위치로 조용히 다시 불러온다.
   - 고친 내용이 있으면 띠 알림: 「다른 프로그램이 이 파일을 바꿨어요 [다시 불러오기] [내 것 유지]」.
   - 기존 `FileFingerprint`·`external_modification_status` 를 재사용한다.
3. **동봉 에이전트 도구 `k-doc-agent`**: release 워크플로에서 `prepare-rhwp.sh`(패치 적용) 뒤 같은 트리로 `rhwp` 바이너리를 빌드해
   앱 번들(`Resources/bin/k-doc-agent`)에 넣는다. PROVENANCE 의 kdocCommit 과 같은지 빌드 때 검사한다.
   `k-doc-agent mcp-serve` 를 MCP 로 등록하는 안내를 README 에 둔다.
4. **글꼴 규칙 고정**: 동봉 도구의 기본 FontEnvironment 를 K-Doc 해석 순서(`docs/architecture/LOCAL_FONTS.md`,
   `font_catalog.rs`)와 같게 한다. 자동 대체 선택을 끈다.
5. **일치 테스트**: 표본 문서(2단 시험지 3종 포함)의 쪽을 (a) 동봉 도구 SVG, (b) studio WASM portable 렌더로 뽑아 바이트 비교.
   화면 보충 메트릭 차이는 별도 측정값으로 기록하고, 필요하면 「portable 보기」 설정을 더한다.

## Verification plan

- 조각마다 CI 검사 통과.
- 2: 데스크톱 테스트에 "밖에서 바뀜 → 이벤트", "고친 내용 있음 → 덮어쓰지 않음" 사례.
- 3·4·5: CI 에서 동봉 도구로 표본 문서를 렌더해 WASM 결과와 비교. 릴리스 산출물에 바이너리가 들어갔는지 검사.

## Rollback

- 2 는 설정으로 끌 수 있게 한다.
- 3 은 번들에서 바이너리만 빼면 앱 동작은 그대로다. release asset 이름은 바꾸지 않는다.
