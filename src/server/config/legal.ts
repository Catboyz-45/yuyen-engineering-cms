/** หน้าที่ของไฟล์นี้: ตรวจเฉพาะค่าระยะเวลาที่นโยบายต้องอ้างถึง โดยไม่เชื่อมฐานข้อมูลหรือส่งค่าลับไปหน้าเว็บ */
import "server-only";
import { z } from "zod";

const legalSettingsSchema = z.object({
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_THROTTLE_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
});

/** อ่านค่าระยะเวลาเดียวกับระบบล็อกอิน เพื่อให้ข้อความในนโยบายตรงกับการทำงานจริง (ช่องทางติดต่อและการรับรองตั้งจากหลังบ้าน) */
export function getLegalSettings(source: Record<string, string | undefined> = process.env) {
  const result = legalSettingsSchema.safeParse(source);
  if (!result.success) throw new Error("Invalid privacy notice configuration");
  return result.data;
}
