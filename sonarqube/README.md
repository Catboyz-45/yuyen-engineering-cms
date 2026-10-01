# SonarQube

ตรวจคุณภาพและความปลอดภัยของโค้ดด้วย SonarQube Community Edition ตามคู่มือ
[sonarqube_manual.pdf](sonarqube_manual.pdf) ซึ่งนำมาจาก <https://github.com/suriyapi/SonarQube>
(จัดทำโดย อาจารย์ ดร. สุริยะ พินิจการ)

| ไฟล์ | ที่มา |
|---|---|
| `../sonar-project.properties` | หัวข้อ 3 ของคู่มือ ปรับ project key และ exclusions ให้ตรงกับโปรเจกต์นี้ |
| `docker-compose.yml` | จาก repo ต้นฉบับ (SonarQube + PostgreSQL) |
| `fetch-issues.sh` | จาก `hook.text` ของ repo ต้นฉบับ แล้วเพิ่มการดึงหน้าถัดไปเมื่อมี issues เกิน 200 รายการ |
| `sonar_report.py` | หัวข้อ 7 ของคู่มือ แล้วเพิ่มฟอนต์ภาษาไทย การตัดบรรทัดในตาราง และนับเฉพาะ issue ที่ยังไม่แก้ |
| `reports/01-initial-scan/` | ผลรอบแรก 305 issues: PDF จากการสแกนครั้งแรก และ `issues.json` จากการสแกนโค้ดชุดเดิม (commit `3bb593f`) ซ้ำด้วยวิธีเดียวกันในโปรเจกต์ `yuyen-engineering-initial` ตรวจแล้วว่าไฟล์ บรรทัด และกฎตรงกับครั้งแรกครบทั้ง 305 รายการ |
| `reports/02-after-fixes/` | issues ทั้งหมดหลังแก้รอบแรก: ไฟล์ JSON มีทั้ง 303 รายการที่แก้แล้ว (CLOSED) และที่ยังเปิดอยู่ พร้อมรายงาน PDF |
| `reports/03-final/` | ผลรอบสุดท้าย: ทั้ง 308 รายการเป็น `CLOSED`, Quality Gate ผ่าน |
| `reports/latest/` | โฟลเดอร์ปลายทางเริ่มต้นของ `fetch-issues.sh` เมื่อไม่ระบุ |

## ขั้นตอน

1. เปิด SonarQube (หัวข้อ 2) แล้วเข้า <http://localhost:9000>

   ```bash
   docker compose -f sonarqube/docker-compose.yml up -d
   ```

2. สร้าง Global Analysis Token ที่ My Account → Security (หัวข้อ 4) แล้วตั้งค่าไว้ใน shell

   ```bash
   export SONAR_TOKEN=<token>
   ```

3. สร้างไฟล์ coverage ให้ SonarQube อ่าน (`coverage/lcov.info`) จาก unit + integration test
   ต้องตั้ง `.env.test` ให้ชี้ฐานข้อมูลทดสอบที่แยกไว้ก่อน (ดู README หลัก หัวข้อ Isolated test configuration)

   ```bash
   npm run test:coverage
   ```

4. สแกนจาก root ของโปรเจกต์ (หัวข้อ 5) รอจนเห็น `EXECUTION SUCCESS`

   ```bash
   docker run --rm --memory=8g -e SONAR_HOST_URL="http://host.docker.internal:9000" -e SONAR_TOKEN="$SONAR_TOKEN" -v "$(pwd):/usr/src" sonarsource/sonar-scanner-cli
   ```

5. ดึงรายการ issues ทั้งหมดเป็น JSON (ระบุโฟลเดอร์ปลายทางเป็นอาร์กิวเมนต์ที่ 3 ได้)

   ```bash
   sonarqube/fetch-issues.sh http://localhost:9000 yuyen-engineering sonarqube/reports/latest
   ```

   คำสั่งตามคู่มือคืนทั้ง issue ที่ยังเปิดและที่แก้แล้ว ให้ดูช่อง `status` (`OPEN` หรือ `CLOSED`)

6. สร้างรายงาน PDF (หัวข้อ 7) ต้องติดตั้ง `pip install requests reportlab` ก่อน

   ```bash
   cd sonarqube/reports && python3 ../sonar_report.py --host http://localhost:9000 --project yuyen-engineering --token "$SONAR_TOKEN"
   ```

   ใส่ `--top 500 --output yuyen-engineering_report_all-issues.pdf` เพื่อให้รายงานแสดง issues ทุกรายการ

## ข้อควรรู้

- **Mac ที่ใช้ชิป Apple:** image `sonarsource/sonar-scanner-cli` มีแต่รุ่น amd64 จึงรันผ่านการจำลองและใช้ RAM มากกว่าปกติ
  ถ้าเจอ `The bridge server is unresponsive` (หัวข้อ 8.1) ให้ดูว่า Docker Desktop มี RAM ว่างพอ
  ตัววิเคราะห์ใช้ราว 3GB ระหว่างสแกน ถ้า container อื่นใช้ RAM ไปมาก ให้หยุดชั่วคราวหรือเพิ่ม Memory ที่ Settings → Resources
- `sonarqube/reports/` ไม่ถูกนำไปสแกนซ้ำ (ตั้งไว้ใน `sonar.exclusions`)
- แจ้งเตือนที่ตรวจแล้วว่าไม่ใช่ปัญหาจริงตั้งไว้ท้าย `sonar-project.properties` พร้อมเหตุผล ตอนนี้มีข้อเดียว:
  ชื่อเหตุการณ์อย่าง `AUTH_PASSWORD_CHANGED` ใน `src/lib/audit-labels.ts` ถูกเข้าใจว่าเป็นรหัสผ่าน
- บน Mac ชิป Apple ขั้น `SCM Publisher` (อ่าน `git blame`) เคยค้างนานผิดปกติ ถ้าค้างเกิน 5 นาทีให้หยุด container แล้วสแกนใหม่
- Coverage นับจาก unit + integration test ส่วนหน้าเว็บ คอมโพเนนต์ API route และสคริปต์ตรวจด้วย Playwright E2E
  ซึ่งไม่สร้างไฟล์ coverage จึงตั้ง `sonar.coverage.exclusions` ไว้ (ยังถูกตรวจหา issue ตามปกติ) และไฟล์ใน `tests/` ถูกวิเคราะห์ในฐานะโค้ดทดสอบ
