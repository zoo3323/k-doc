<div align="center">

<img src="apps/desktop/src-tauri/icons-hangul/logo-256.png" width="112" alt="">

# 한글 편집기

### 한글 문서(HWP·HWPX)를 **무료로** 열고 고치세요

<img src="https://img.shields.io/badge/%EA%B0%80%EA%B2%A9-0%EC%9B%90-16a34a?style=flat-square" alt="가격 0원">
<img src="https://img.shields.io/badge/%EA%B4%91%EA%B3%A0-%EC%97%86%EC%9D%8C-0ea5e9?style=flat-square" alt="광고 없음">
<img src="https://img.shields.io/badge/%ED%9A%8C%EC%9B%90%EA%B0%80%EC%9E%85-%ED%95%84%EC%9A%94%20%EC%97%86%EC%9D%8C-6366f1?style=flat-square" alt="회원가입 필요 없음">
<img src="https://img.shields.io/badge/%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4-MIT-64748b?style=flat-square" alt="오픈소스 MIT">

<br><br>

<a href="https://github.com/zoo3323/hangul-editor/releases/latest/download/hangul-editor-macos-arm64.dmg"><img src="https://img.shields.io/badge/macOS-Apple_%EC%B9%A9-111827?style=for-the-badge&logo=apple&logoColor=white" alt="macOS Apple 칩"></a>
<a href="https://github.com/zoo3323/hangul-editor/releases/latest/download/hangul-editor-macos-x64.dmg"><img src="https://img.shields.io/badge/macOS-%EC%9D%B8%ED%85%94-4B5563?style=for-the-badge&logo=apple&logoColor=white" alt="macOS 인텔"></a>
<a href="https://github.com/zoo3323/hangul-editor/releases/latest/download/hangul-editor-windows-x64-setup.exe"><img src="https://img.shields.io/badge/Windows-%EB%82%B4%EB%A0%A4%EB%B0%9B%EA%B8%B0-2563EB?style=for-the-badge&logo=windows&logoColor=white" alt="Windows"></a>
<a href="https://github.com/zoo3323/hangul-editor/releases/latest/download/hangul-editor-linux-x64.deb"><img src="https://img.shields.io/badge/Linux-.deb-F59E0B?style=for-the-badge&logo=linux&logoColor=white" alt="Linux"></a>

<img src="docs/images/app.png" width="920" alt="한글 편집기로 HWP 문서를 연 화면">

</div>

## 💸 한컴오피스가 없어도 됩니다

| 💰 | 🚫 | 🙅 | 📴 |
| :---: | :---: | :---: | :---: |
| **0원** | **광고 없음** | **가입 없음** | **인터넷 없이** |
| 완전 무료 | 깨끗한 화면 | 설치하면 끝 | 내 컴퓨터에서만 |

<table>
<tr>
<td width="50%"><img src="docs/images/start.png" alt="시작 화면"></td>
<td width="50%"><img src="docs/images/dark.png" alt="어두운 화면"></td>
</tr>
<tr>
<td align="center">시작 화면</td>
<td align="center">어두운 화면</td>
</tr>
</table>

<a id="설치"></a>

## 📥 설치

<img src="docs/images/install-steps.png" alt="내려받기 → 열기 → 끝">

**한 줄로 설치** — 복사해서 붙여넣기만 하면 됩니다.

🍎 macOS · 터미널

```sh
curl -fsSL https://raw.githubusercontent.com/zoo3323/hangul-editor/main/install/install-mac.sh | bash
```

🪟 Windows · PowerShell

```powershell
irm https://raw.githubusercontent.com/zoo3323/hangul-editor/main/install/install-windows.ps1 | iex
```

🐧 Linux · 터미널

```sh
curl -fsSL https://raw.githubusercontent.com/zoo3323/hangul-editor/main/install/install-linux.sh | bash
```

<details>
<summary>⚠️ 처음 열 때 경고가 나오면</summary>

| | 이렇게 하세요 |
| --- | --- |
| 🍎 macOS | **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기** |
| 🪟 Windows | **추가 정보 → 실행** |

개인이 만든 무료 앱이라 유료 인증서가 없어 한 번 나오는 경고입니다. 한 줄 설치를 쓰면 나오지 않습니다.
</details>

## 🛠️ HOP·rhwp의 문제를 고쳤습니다

원래 오픈소스 [HOP](https://github.com/golbin/hop)과 [rhwp](https://github.com/edwardkim/rhwp)에서 알려진 주요 문제를 고쳐 넣었습니다.

| | 고친 문제 | 원래 |
| :---: | --- | :---: |
| 🧾 | 2단 문서에서 머리 표·상자·그림이 서로 겹치던 문제 | rhwp |
| 💥 | 일부 문서를 열면 앱이 멈추던 문제 | rhwp |
| 💾 | 저장하면 묶음 도형의 설명이 사라지던 문제 | rhwp |
| 📑 | 머리말이 틀을 넘으면 글이 사라지던 문제 | rhwp |
| 📊 | 표 안의 표를 고치면 바깥 표가 망가지던 문제 | rhwp |
| 🔤 | 글꼴 목록이 열리지 않던 문제 | HOP |
| 🔗 | 링크를 누르면 "팝업 차단"으로 막히던 문제 | HOP |
| ⌨️ | macOS 창 메뉴와 단축키 표시가 어긋나던 문제 | HOP |
| 🎨 | 회색으로 낡아 보이던 화면 → 새 디자인 | HOP |

<details>
<summary>자세히 (이슈·PR 번호)</summary>

| 고친 문제 | 출처 |
| --- | --- |
| 2단 문서 개체 겹침 | rhwp #8158 · 이 저장소의 엔진 수정 |
| 앱 멈춤 | rhwp PR #8286 |
| 묶음 도형 설명 사라짐 | rhwp #8225 (PR #8233) |
| 머리말 넘침 | rhwp PR #8293 |
| 표 안의 표 편집 | rhwp #8138 |
| 글꼴 목록 | HOP #106 · #119 |
| 링크 열기 | HOP #111 |
| macOS 창 메뉴·단축키 | HOP PR #105 · #110 |

엔진 수정은 [`patches/rhwp/`](patches/rhwp), 원래 HOP 설명은 [`docs/HOP-README.md`](docs/HOP-README.md)에 있습니다.
</details>

## ✅ 할 수 있는 것

| 📂 열기 | ✏️ 편집 | 💾 HWP 저장 | 📄 PDF | 🖨️ 인쇄 | 🌙 다크 모드 |
| :---: | :---: | :---: | :---: | :---: | :---: |
| HWP · HWPX | 글자 · 표 · 그림 | 원본 형식 그대로 | 내보내기 | 바로 인쇄 | 눈이 편하게 |

<details>
<summary>🛠️ 직접 빌드</summary>

필요한 것: rustup(`wasm32-unknown-unknown`), wasm-pack 0.15, Node 22+, pnpm 10

```sh
scripts/build-hangul-editor.sh
```

설치 파일은 `v*` 태그를 올리면 [GitHub Actions](.github/workflows/release.yml)가 macOS·Windows·Linux 용으로 만듭니다.
</details>

<div align="center">
<sub>
<a href="https://github.com/golbin/hop">HOP</a>와 <a href="https://github.com/edwardkim/rhwp">rhwp</a>(모두 MIT)를 바탕으로 만든 개인 프로젝트입니다 · 한글과컴퓨터와 관계없습니다
</sub>
</div>
