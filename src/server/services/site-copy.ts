/**
 * หน้าที่ของไฟล์นี้: ตรวจข้อความบนหน้าเว็บที่ส่งมาจากหลังบ้าน และอ่านค่าที่เก็บไว้อย่างปลอดภัยก่อนแสดงผล
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ข้อความทั้งหมดแสดงเป็นตัวอักษรธรรมดา ไม่รองรับ HTML เพื่อกันการแทรกโค้ด
 */
import { z } from "zod";
import { COPY_ITEM_LIMITS, DEFAULT_SITE_COPY, HIGHLIGHT_LIMIT, PROCESS_STEP_LIMIT, STAT_LIMIT, STAT_LIMITS, siteCopyTextFields, type SiteCopy } from "@/lib/site-copy";

const item = z.object({
  title: z.string().trim().min(1).max(COPY_ITEM_LIMITS.title),
  text: z.string().trim().max(COPY_ITEM_LIMITS.text),
}).strict();

const stat = z.object({
  value: z.number().int().min(0).max(STAT_LIMITS.value),
  suffix: z.string().trim().max(STAT_LIMITS.suffix),
  label: z.string().trim().min(1).max(STAT_LIMITS.label),
}).strict();

const textShape = Object.fromEntries(siteCopyTextFields.map(field => [
  field.key,
  field.required ? z.string().trim().min(1).max(field.max) : z.string().trim().max(field.max),
])) as Record<(typeof siteCopyTextFields)[number]["key"], z.ZodString>;

export const siteCopySchema = z.object({
  ...textShape,
  highlights: z.array(item).max(HIGHLIGHT_LIMIT),
  processSteps: z.array(item).max(PROCESS_STEP_LIMIT),
  stats: z.array(stat).max(STAT_LIMIT),
}).strict();

/**
 * ยังไม่เคยบันทึก = ค่าเริ่มต้น; บันทึกแล้วใช้ค่าที่บริษัทกรอก (ช่องว่างถูกซ่อนในหน้าเว็บ)
 * ช่องที่ไม่ผ่านการตรวจหรือเพิ่มในเวอร์ชันหลังใช้ค่าเริ่มต้นเฉพาะช่องนั้น ไม่ทำให้หน้าเว็บพัง
 */
export function resolveSiteCopy(stored: unknown): SiteCopy {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return DEFAULT_SITE_COPY;
  const shape = siteCopySchema.shape;
  const values = stored as Record<string, unknown>;
  const resolved = { ...DEFAULT_SITE_COPY } as Record<keyof SiteCopy, unknown>;
  for (const key of Object.keys(shape) as (keyof SiteCopy)[]) {
    const parsed = shape[key].safeParse(values[key]);
    if (parsed.success) resolved[key] = parsed.data;
  }
  return resolved as SiteCopy;
}
