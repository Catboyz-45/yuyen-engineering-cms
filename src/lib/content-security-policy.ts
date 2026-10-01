/**
 * หน้าที่ของไฟล์นี้: สร้าง Content-Security-Policy จากค่าที่อ่านตอนรันระบบ ไม่ใช่ตอน build
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: storage origin เปลี่ยนตาม environment จึงต้องใส่ตอนรัน ไม่เช่นนั้นรูปภาพจาก CMS จะถูกบล็อก
 */
const mapFrameSources = [
  "https://www.google.com/maps/embed",
  "https://www.google.com/maps/embed/",
  "https://maps.google.com/maps/embed",
  "https://maps.google.com/maps/embed/",
];

/** เครื่องตัวเอง (localhost) ไม่มี HTTPS: Safari/WebKit อัปเกรดคำขอไป localhost เป็น https ด้วย ซึ่งทำให้สคริปต์ทุกตัวโหลดไม่ได้ */
function isLoopbackHttp(appUrl: string | undefined) {
  if (!appUrl) return false;
  try {
    const url = new URL(appUrl);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

/** ประกอบ CSP; storageOrigins คือปลายทางของ signed URL ที่ต้องโหลดรูปและอัปโหลดไฟล์ได้ appUrl ใช้งดอัปเกรด HTTPS เฉพาะการทดสอบบนเครื่องตัวเอง */
export function buildContentSecurityPolicy({ nodeEnv, storageOrigins, appUrl }: { nodeEnv: string | undefined; storageOrigins: readonly string[]; appUrl?: string }) {
  const storage = storageOrigins.map((origin) => ` ${origin}`).join("");
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    `frame-src ${mapFrameSources.join(" ")}`,
    "form-action 'self'",
    `img-src 'self' data: blob:${storage}`,
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'unsafe-inline'${nodeEnv === "development" ? " 'unsafe-eval'" : ""}`,
    `connect-src 'self'${storage}`,
    "media-src 'self' blob:",
    ...(nodeEnv === "production" && !isLoopbackHttp(appUrl) ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}
