/**
 * หน้าที่ของไฟล์นี้: ตัวช่วยสำหรับชุดทดสอบ Playwright ที่ต้องเข้าหน้า CMS โดยสร้างผู้ดูแลทดสอบชั่วคราวและ session ในฐานข้อมูลโดยตรง
 * ใช้กับฐานข้อมูลสำหรับพัฒนา/ทดสอบเท่านั้น ผู้ดูแลที่สร้างไม่มีรหัสผ่านที่ใช้เข้าสู่ระบบได้จริง และต้องลบทิ้งหลังจบชุดทดสอบ
 */
import { test, type Page } from "@playwright/test";
import type { PrismaClient } from "@prisma/client";
import { createHash, randomBytes, randomUUID } from "node:crypto";

/** สร้าง Super Admin ทดสอบที่ผ่าน 2FA แล้ว; passwordHash ไม่ใช่ hash จริงจึงเข้าสู่ระบบด้วยรหัสผ่านไม่ได้ */
export async function createCmsTestAdmin(database: PrismaClient, usernamePrefix: string, displayName: string) {
  const username = `${usernamePrefix}-${randomUUID().slice(0, 8)}`;
  const admin = await database.admin.create({
    data: {
      username,
      usernameNormalized: username,
      displayName,
      role: "SUPER_ADMIN",
      passwordHash: "playwright-test-session-only",
      mustChangePassword: false,
      twoFactorEnabled: true,
    },
    select: { id: true },
  });
  return admin.id;
}

/** ลบผู้ดูแลทดสอบพร้อม audit log ที่ผู้ดูแลนั้นสร้าง; session ถูกลบตาม onDelete: Cascade */
export async function deleteCmsTestAdmin(database: PrismaClient, adminId: string) {
  if (!adminId) return;
  await database.auditLog.deleteMany({ where: { actorId: adminId } });
  await database.admin.deleteMany({ where: { id: adminId } });
}

/** ออก session ที่ยืนยัน 2FA แล้วให้ผู้ดูแลทดสอบ และใส่ cookie ลงใน browser context ของหน้า */
export async function addCmsSession(page: Page, database: PrismaClient, adminId: string) {
  const token = randomBytes(32).toString("base64url");
  await database.session.create({
    data: {
      tokenHash: createHash("sha256").update(token).digest("hex"),
      adminId,
      twoFactorAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const url = test.info().project.use.baseURL ?? "http://localhost:3000";
  await page.context().addCookies([{ name: "yuyen_session", value: token, url, httpOnly: true, sameSite: "Lax" }]);
}
