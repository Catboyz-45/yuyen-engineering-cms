/**
 * หน้าที่ของไฟล์นี้: คำนวณ origin ที่เบราว์เซอร์ใช้เปิด signed URL ของ object storage เพื่อให้ CSP อนุญาตเฉพาะปลายทางนี้
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: รูปภาพและการอัปโหลดวิ่งไปที่ storage โดยตรง ถ้า origin ไม่อยู่ใน CSP เบราว์เซอร์จะบล็อก
 */
import { z } from "zod";

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);
// ชื่อ bucket ตามกฎ DNS เท่านั้น เพื่อไม่ให้ค่าผิดรูปแทรก directive อื่นเข้า CSP
const bucketName = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

const schema = z.object({
  S3_PUBLIC_ENDPOINT: optionalUrl,
  S3_ENDPOINT: optionalUrl,
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().trim().min(1).default("auto"),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false"),
});

/** คืน origin ที่ signed URL อาจใช้; คืนรายการว่างเมื่อยังไม่ได้ตั้งค่า storage หรือค่าไม่ถูกต้อง */
export function storageBrowserOrigins(source: Record<string, string | undefined> = process.env): string[] {
  const parsed = schema.safeParse(source);
  if (!parsed.success) return [];
  const env = parsed.data;
  const bucket = env.S3_BUCKET && bucketName.test(env.S3_BUCKET) ? env.S3_BUCKET : undefined;
  const endpoint = env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT;
  if (endpoint) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.protocol !== "http:") return [];
    // AWS SDK ใช้ virtual-hosted style (bucket.host) เมื่อไม่บังคับ path style แต่ถอยกลับเป็น path style ได้
    return env.S3_FORCE_PATH_STYLE === "true" || !bucket ? [url.origin] : [url.origin, `${url.protocol}//${bucket}.${url.host}`];
  }
  if (!bucket || env.S3_REGION === "auto" || !/^[a-z0-9-]+$/.test(env.S3_REGION)) return [];
  const regional = `s3.${env.S3_REGION}.amazonaws.com`;
  return env.S3_FORCE_PATH_STYLE === "true" ? [`https://${regional}`] : [`https://${bucket}.${regional}`, `https://${regional}`];
}
