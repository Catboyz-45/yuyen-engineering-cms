/**
 * หน้าที่ของไฟล์นี้: เปิด HTTPS บนเครื่องตัวเองเพื่อทดสอบ production build ด้วย Safari (WebKit) เท่านั้น ห้ามใช้กับ production จริง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: production ใช้ cookie แบบ Secure ซึ่ง WebKit รับเฉพาะผ่าน HTTPS (Chromium ยอมบน http://localhost)
 * สคริปต์นี้สร้างใบรับรองชั่วคราวแบบ self-signed แล้วส่งต่อคำขอไปยังเซิร์ฟเวอร์ next start ที่ฟังอยู่บน http
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

const listenPort = Number(process.env.E2E_HTTPS_PORT ?? "3443");
const targetPort = Number(process.env.PLAYWRIGHT_PORT ?? "3000");

// ใบรับรองอายุ 1 วัน สร้างใหม่ทุกครั้งในโฟลเดอร์ชั่วคราว ไม่เก็บไว้ใน repository
const directory = mkdtempSync(join(tmpdir(), "yuyen-e2e-tls-"));
const keyPath = join(directory, "key.pem");
const certPath = join(directory, "cert.pem");
execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1", "-keyout", keyPath, "-out", certPath], { stdio: "ignore" });
const credentials = { key: readFileSync(keyPath), cert: readFileSync(certPath) };
rmSync(directory, { recursive: true, force: true });

const server = createServer(credentials, (incoming, outgoing) => {
  const upstream = httpRequest(
    { host: "127.0.0.1", port: targetPort, method: incoming.method, path: incoming.url, headers: { ...incoming.headers, "x-forwarded-proto": "https" } },
    response => {
      outgoing.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(outgoing);
    },
  );
  upstream.on("error", () => {
    if (!outgoing.headersSent) outgoing.writeHead(502);
    outgoing.end();
  });
  incoming.pipe(upstream);
});

// ฟังทุก address แบบเดียวกับ next start เพราะ localhost อาจชี้ไป ::1 หรือ 127.0.0.1 แล้วแต่เครื่อง
server.listen(listenPort, () => console.log(`HTTPS test proxy https://localhost:${listenPort} → http://127.0.0.1:${targetPort}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit(0)));
