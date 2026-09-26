/**
 * หน้าที่ของไฟล์นี้: ชุดทดสอบ cms-auth.e2e.spec ยืนยันว่าล็อกอินไม่เปิดเผยว่าชื่อผู้ใช้มีอยู่หรือไม่
 * การล็อกอินครั้งแรกด้วยบัญชีเริ่มต้นทดสอบใน cms-workflows.e2e.spec เพราะรหัสผ่านชั่วคราวใช้ได้ครั้งเดียว
 */
import { expect, test } from "@playwright/test";

test("login rejects invalid credentials without account enumeration", async ({ request }) => {
  const headers = { Origin: process.env.APP_URL ?? "http://localhost:3000" };
  const unknown = await request.post("/api/auth/login", { headers, data: { username: "missing-user", password: "Wrong-Password1!" } });
  const malformed = await request.post("/api/auth/login", { headers, data: { username: "x", password: "short" } });
  expect(unknown.status()).toBe(401);
  expect((await unknown.json()).error).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
  expect(malformed.status()).toBe(400);
  expect((await malformed.json()).error).toBe("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
});
