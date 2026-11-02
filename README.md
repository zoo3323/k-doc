<div align="center">

<img src="apps/desktop/src-tauri/icons-app/logo-256.png" width="96" alt="">

# K-Doc

한글 문서(HWP·HWPX)를 무료로 열고 고치는 앱입니다.

<img src="docs/images/app.png" width="860" alt="K-Doc으로 HWP 문서를 연 화면">

</div>

<a id="설치"></a>

## 설치

### macOS

1. **⌘ + 스페이스**를 누르고 `터미널`을 입력한 뒤 **Enter**
2. 아래 줄을 복사해 붙여 넣고 **Enter**

```sh
curl -fsSL https://raw.githubusercontent.com/zoo3323/k-doc/main/install/install-mac.sh | bash
```

<img src="docs/images/install-mac.gif" width="720" alt="터미널에 설치 줄을 붙여 넣으면 K-Doc이 설치되고 바로 열린다">

Apple 칩과 인텔 Mac 모두 됩니다. 새 버전이 나오면 같은 줄을 다시 실행하면 업데이트됩니다.

### Windows

[k-doc-windows-x64-setup.exe](https://github.com/zoo3323/k-doc/releases/latest/download/k-doc-windows-x64-setup.exe)를 받아 실행합니다. 처음 실행할 때 보안 경고가 나오면 **추가 정보 → 실행**을 누릅니다.

### Linux

[k-doc-linux-x64.deb](https://github.com/zoo3323/k-doc/releases/latest/download/k-doc-linux-x64.deb)를 받아 설치합니다. 터미널에서는 아래 한 줄로도 됩니다.

```sh
curl -fsSL https://raw.githubusercontent.com/zoo3323/k-doc/main/install/install-linux.sh | bash
```

## 직접 빌드

필요한 것: rustup(`wasm32-unknown-unknown`), wasm-pack 0.15, Node 22+, pnpm 10

```sh
scripts/build-k-doc.sh
```

<sub>
<a href="https://github.com/golbin/hop">HOP</a>과 <a href="https://github.com/edwardkim/rhwp">rhwp</a>(모두 MIT)를 바탕으로 만들었습니다. <a href="NOTICE.md">라이선스·고지</a><br>
본 제품은 한글과컴퓨터의 한글 문서 파일(.hwp) 공개 문서를 참고하여 개발하였습니다.<br>
"한글", "한컴", "HWP", "HWPX"는 주식회사 한글과컴퓨터의 등록 상표이며, K-Doc은 한글과컴퓨터와 관계없습니다.
</sub>
