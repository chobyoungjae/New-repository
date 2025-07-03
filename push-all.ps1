# ────────────────────────────────────────────────────────────
# push-all.ps1
# (스크립트 백업(중요) 폴더에 넣고 실행)
# ────────────────────────────────────────────────────────────

# 1) 한 번만 실행하면 되는 스크립트이므로 인코딩, 경로 문제를 피해갑니다
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 2) 현재 작업 디렉토리(=스크립트 백업(중요)) 저장
$origin = Get-Location

# 3) 하위 폴더 전부 뒤져서 .clasp.json 찾기
Get-ChildItem -Recurse -Filter ".clasp.json" | ForEach-Object {
    $projDir = $_.DirectoryName
    Write-Host "📤 Pushing Apps Script in: $projDir" -ForegroundColor Cyan

    # 4) 해당 폴더로 가서 clasp push
    Push-Location $projDir
    clasp push
    Pop-Location
}

# 5) 끝나면 원위치 복귀
Set-Location $origin
Write-Host "✅ 모든 프로젝트 push 완료" -ForegroundColor Green
