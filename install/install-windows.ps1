# 한글 편집기 Windows 설치: 최신 설치 파일을 내려받아 조용히 설치한다(관리자 권한 필요 없음).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # 진행 막대를 끄면 내려받기가 훨씬 빠르다
$repo = 'zoo3323/hangul-editor'
$url = "https://github.com/$repo/releases/latest/download/hangul-editor-windows-x64-setup.exe"
$exe = Join-Path $env:TEMP 'hangul-editor-setup.exe'

Write-Host '한글 편집기를 내려받는 중...'
Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
Write-Host '설치하는 중...'
Start-Process -FilePath $exe -ArgumentList '/S' -Wait
Remove-Item $exe -Force
Write-Host '설치 완료! 시작 메뉴에서 "한글 편집기"를 찾아 실행하세요.'
