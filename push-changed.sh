#!/usr/bin/env bash
# push-changed.sh — 변경된 GAS 프로젝트만 push

# 0) 반드시 LF 줄바꿈, UTF-8 (BOM 없음) 유지
# 1) 스크립트 위치로 이동
cd "/c/Users/미쓰리/Desktop/스크립트 백업(중요)" || { echo "❌ 경로 실패"; exit 1; }

echo "🔍 변경된 파일 경로 수집 중..."

# 2) -z 로 null 문자로 구분, core.quotepath=false 로 한글 깨짐 방지
git -c core.quotepath=false status --porcelain -z \
  | while IFS= read -r -d '' entry; do
      # 상태(첫 세 글자) 제거
      path="${entry:3}"
      # 문자열 양끝 따옴표 제거
      path="${path#\"}"
      path="${path%\"}"
      echo "→ 파일: $path"

      dir=$(dirname "$path")
      # 3) .clasp.json 확인
      if [ -f "$dir/.clasp.json" ]; then
        echo "📤 Pushing $dir"
        ( cd "$dir" && clasp push )
      fi
    done

echo "✅ Done."
