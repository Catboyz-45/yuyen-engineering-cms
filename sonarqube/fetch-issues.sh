#!/usr/bin/env bash
# ดึง issues ทั้งหมดของโปรเจกต์จาก SonarQube Web API ตาม hook.text ในคู่มือ
# ใช้: SONAR_TOKEN=<token> sonarqube/fetch-issues.sh [host] [projectKey] [โฟลเดอร์ผลลัพธ์]
# ได้ไฟล์ issues.json (หน้าแรก ps=200 ตามคู่มือ) ในโฟลเดอร์ผลลัพธ์ (ค่าเริ่มต้น sonarqube/reports/latest)
# ผลลัพธ์รวม issue ที่แก้แล้วด้วย (status CLOSED) ตามคำสั่งในคู่มือ จึงเห็นประวัติการแก้ในไฟล์เดียว
# ถ้ามีเกิน 200 รายการ จะดึงหน้าถัดไปเป็น issues-page-2.json, issues-page-3.json, ...
set -euo pipefail
: "${SONAR_TOKEN:?ตั้งค่า SONAR_TOKEN ก่อน}"
HOST="${1:-http://localhost:9000}"
PROJECT="${2:-yuyen-engineering}"
OUT="${3:-$(cd "$(dirname "$0")" && pwd)/reports/latest}"
mkdir -p "$OUT"

curl -sf -u "$SONAR_TOKEN:" \
  "$HOST/api/issues/search?componentKeys=$PROJECT&ps=200" \
  -o "$OUT/issues.json"

total=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["total"])' "$OUT/issues.json")
pages=$(( (total + 199) / 200 ))
for ((p = 2; p <= pages && p <= 50; p++)); do
  curl -sf -u "$SONAR_TOKEN:" \
    "$HOST/api/issues/search?componentKeys=$PROJECT&ps=200&p=$p" \
    -o "$OUT/issues-page-$p.json"
done
echo "ดึง issues ได้ $total รายการ ($pages หน้า) ไว้ที่ $OUT"
