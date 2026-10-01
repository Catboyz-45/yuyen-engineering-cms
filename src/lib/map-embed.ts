/** หน้าที่ของไฟล์นี้: รับเฉพาะ URL แผนที่ Google แบบฝังที่กำหนดไว้ ป้องกันการฝังเว็บไซต์อื่นจากข้อมูลที่บันทึกไว้ */
import { z } from "zod";

const mapEmbedSchema = z.string().trim().max(2000).url().refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && ["www.google.com", "maps.google.com"].includes(url.hostname)
      && !url.username && !url.password && !url.port
      && (url.pathname === "/maps/embed" || url.pathname.startsWith("/maps/embed/"));
  } catch {
    return false;
  }
});

/** ค่าเดิมจาก CMS หรือ environment อาจยังไม่ผ่านกฎใหม่ จึงปิดแผนที่เมื่อ URL ไม่ถูกต้อง */
export function safeMapEmbedUrl(value: unknown): string | null {
  const result = mapEmbedSchema.safeParse(value);
  return result.success ? result.data : null;
}
