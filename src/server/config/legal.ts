/** หน้าที่ของไฟล์นี้: ตรวจเฉพาะค่าที่นโยบายต้องใช้ โดยไม่เชื่อมฐานข้อมูลหรือส่งค่าลับไปหน้าเว็บ */
import "server-only";
import { z } from "zod";

const legalSettingsSchema = z.object({
  LEGAL_NOTICE_APPROVED: z.enum(["true", "false"]).default("false"),
  PRIVACY_CONTACT_EMAIL: z.preprocess(
    value => value === "" ? undefined : value,
    z.string().trim().email().max(254).optional(),
  ),
  SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(240).default(30),
  AUTH_SESSION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_THROTTLE_RETENTION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
}).superRefine((value, context) => {
  if (value.LEGAL_NOTICE_APPROVED === "true" && !value.PRIVACY_CONTACT_EMAIL) {
    context.addIssue({ code: "custom", path: ["PRIVACY_CONTACT_EMAIL"], message: "A confirmed privacy contact is required" });
  }
});

/** อ่านค่าระยะเวลาเดียวกับระบบล็อกอิน และไม่อนุญาตประกาศฉบับรับรองที่ไม่มีช่องทางใช้สิทธิ์ */
export function getLegalSettings(source: Record<string, string | undefined> = process.env) {
  const result = legalSettingsSchema.safeParse(source);
  if (!result.success) throw new Error("Invalid privacy notice configuration");
  return result.data;
}
