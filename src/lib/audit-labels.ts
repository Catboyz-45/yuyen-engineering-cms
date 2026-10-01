/**
 * หน้าที่ของไฟล์นี้: แปลรหัสกิจกรรมใน audit log (เช่น CONTENT_PUBLISHED) เป็นประโยคภาษาไทยสำหรับหน้าภาพรวมหลังบ้าน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: รหัสที่ยังไม่มีคำแปลจะแสดงรหัสเดิม จึงไม่มีกิจกรรมใดหายไปจากรายการ
 */
const targetNouns: Record<string, string> = {
  Banner: "แบนเนอร์", Service: "บริการ", Product: "สินค้า", Project: "ผลงาน", News: "ข่าวสาร", Content: "เนื้อหา",
  Brand: "ยี่ห้อ", ProductType: "ประเภทสินค้า", NewsCategory: "หมวดหมู่ข่าว", Media: "ไฟล์", Admin: "บัญชีผู้ดูแล",
};

const contentVerbs: Record<string, (noun: string) => string> = {
  CREATED: noun => `สร้าง${noun}`,
  UPDATED: noun => `แก้ไข${noun}`,
  PUBLISHED: noun => `เผยแพร่${noun}`,
  DRAFT: noun => `เปลี่ยน${noun}เป็นฉบับร่าง`,
  ARCHIVED: noun => `เก็บ${noun}เข้าคลัง`,
  TRASHED: noun => `ย้าย${noun}ลงถังขยะ`,
  RESTORED: noun => `กู้คืน${noun}`,
  DELETED_PERMANENTLY: noun => `ลบ${noun}ถาวร`,
};

const fixed: Record<string, string> = {
  COMPANY_CREATED: "บันทึกข้อมูลบริษัทครั้งแรก",
  COMPANY_UPDATED: "แก้ไขข้อมูลบริษัท",
  LEGAL_NOTICE_UPDATED: "แก้ไขข้อมูลนโยบายเว็บไซต์",
  LEGAL_NOTICE_APPROVED: "รับรองและประกาศใช้นโยบายเว็บไซต์",
  LEGAL_NOTICE_WITHDRAWN: "ยกเลิกการรับรองนโยบายเว็บไซต์",
  AUTH_LOGIN: "เข้าสู่ระบบ",
  AUTH_LOGOUT: "ออกจากระบบ",
  AUTH_PASSWORD_VERIFIED: "ยืนยันรหัสผ่าน",
  AUTH_TOTP: "ยืนยันตัวตนสองขั้นตอน",
  AUTH_TOTP_ENROLLED: "ตั้งค่าการยืนยันตัวตนสองขั้นตอน",
  AUTH_RECOVERY_CODE: "ใช้รหัสกู้คืน",
  AUTH_PASSWORD_CHANGED: "เปลี่ยนรหัสผ่าน",
  ADMIN_CREATED: "เพิ่มบัญชีผู้ดูแล",
  ADMIN_UPDATED: "แก้ไขบัญชีผู้ดูแล",
  ADMIN_PASSWORD_RESET: "ออกรหัสผ่านชั่วคราวให้ผู้ดูแล",
  ADMIN_TWO_FACTOR_RESET: "รีเซ็ตการยืนยันตัวตนสองขั้นตอนของผู้ดูแล",
  ADMIN_TRASHED: "ย้ายบัญชีผู้ดูแลลงถังขยะ",
  ADMIN_RESTORED: "กู้คืนบัญชีผู้ดูแล",
  ADMIN_DELETED_PERMANENTLY: "ลบบัญชีผู้ดูแลถาวร",
  ADMIN_SELF_PASSWORD_CHANGED: "เปลี่ยนรหัสผ่านของตัวเอง",
  ADMIN_SELF_PROFILE_UPDATED: "แก้ไขโปรไฟล์ของตัวเอง",
  EMERGENCY_ADMIN_RECOVERY: "กู้บัญชีฉุกเฉินจากเซิร์ฟเวอร์",
  MEDIA_UPLOAD_COMPLETED: "อัปโหลดไฟล์",
  MEDIA_ALT_TEXT_UPDATED: "แก้คำอธิบายรูป",
  MEDIA_TRASHED: "ลบไฟล์",
};

/** คืนประโยคภาษาไทยของกิจกรรม; กิจกรรมที่ล้มเหลวจะต่อท้ายว่า "ไม่สำเร็จ" */
export function auditLabel(action: string, targetType?: string | null, result: "SUCCESS" | "FAILURE" = "SUCCESS") {
  const failed = result === "FAILURE" || action.endsWith("_FAILED");
  const code = action.replace(/_FAILED$/, "");
  const noun = targetNouns[targetType ?? ""] ?? "เนื้อหา";
  const match = /^(CONTENT|TAXONOMY)_(.+)$/.exec(code);
  const label = fixed[code] ?? (match && contentVerbs[match[2]]?.(noun)) ?? action;
  return failed && label !== action ? `${label} (ไม่สำเร็จ)` : label;
}
