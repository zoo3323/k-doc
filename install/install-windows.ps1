# K-Doc Windows 설치: 최신 설치 파일을 내려받아 조용히 설치한다(관리자 권한 필요 없음).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # 진행 막대를 끄면 내려받기가 훨씬 빠르다
$repo = 'zoo3323/k-doc'
$url = "https://github.com/$repo/releases/latest/download/k-doc-windows-x64-setup.exe"
$exe = Join-Path $env:TEMP 'k-doc-setup.exe'

Write-Host 'K-Doc을 내려받는 중...'
Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
Write-Host '설치하는 중...'
Start-Process -FilePath $exe -ArgumentList '/S' -Wait
Remove-Item $exe -Force
Write-Host '설치 완료! 시작 메뉴에서 "K-Doc"을 찾아 실행하세요.'
