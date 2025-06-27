# ────────────────────────────────────────────────────────────
# push-changed.ps1
# “스크립트 백업(중요)” 폴더에 두고 실행
# ────────────────────────────────────────────────────────────

# 1) 출력 인코딩 강제 (이모지·한글 깨짐 방지)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 2) 작업 폴더(스크립트 백업(중요)) 저장
$origin = $PSScriptRoot
Write-Host "`n🔍 변경된 파일 경로 수집 중..." -ForegroundColor Yellow

# 3) Git에서 한글/공백 깨짐 없이 상태 가져오기
$lines = git -c core.quotepath=false status --porcelain

# 4) 변경된 파일들의 상위 폴더만 골라내고, .clasp.json 있는 프로젝트만 추려냄
$projects = (
    foreach ($l in $lines) {
        $path = $l.Substring(3).Trim('"')
        Write-Host "→ 파일: $path"

        # 수정된 파일의 상위 폴더
        $proj = Split-Path $path -Parent
        $fullProj = Join-Path $origin $proj

        # .clasp.json 확인
        if (Test-Path (Join-Path $fullProj ".clasp.json")) {
            Write-Host "✅ Apps Script 프로젝트: $fullProj"
            $fullProj
        }
    }
) | Sort-Object -Unique

# 5) 없으면 종료
if ($projects.Count -eq 0) {
    Write-Host "`n❗ 변경된 Apps Script 프로젝트가 없습니다." -ForegroundColor Red
    exit
}

# 6) 각 프로젝트마다 clasp push 실행
foreach ($proj in $projects) {
    Write-Host "`n📤 CLASP PUSH: $proj" -ForegroundColor Cyan
    Push-Location $proj
    clasp push
    Pop-Location
}

# 7) 원위치 복귀 및 완료 메시지
Set-Location $origin
Write-Host "`n✅ 모든 변경된 프로젝트 push 완료" -ForegroundColor Green
