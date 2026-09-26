/** หน้าที่ของไฟล์นี้: รวมชื่อและลิงก์นโยบาย เพื่อให้ท้ายเว็บและหน้าล็อกอินใช้ข้อความตรงกัน */
export const legalLinks = [
  { href: "/privacy", label: "นโยบายความเป็นส่วนตัว" },
  { href: "/cookies", label: "นโยบายคุกกี้" },
  { href: "/terms", label: "เงื่อนไขการใช้เว็บไซต์" },
] as const;

/**
 * ฉบับของข้อความนโยบายในโค้ด เปลี่ยนค่านี้ทุกครั้งที่แก้เนื้อหานโยบาย
 * การรับรองจากหลังบ้านผูกกับฉบับนี้ เมื่อค่าเปลี่ยน หน้านโยบายจะกลับเป็นฉบับร่างจนกว่า Super Admin จะรับรองใหม่
 */
export const legalRevision = "25 กันยายน 2569";

export type LegalNoticeRecord = {
  privacyEmail: string | null;
  serviceProviders: string | null;
  retention: string | null;
  approvedAt: Date | string | null;
  approvedRevision: string | null;
};

/** รับรองแล้วเฉพาะเมื่อรับรองข้อความฉบับปัจจุบันและมีข้อมูลที่บริษัทต้องยืนยันครบ */
export function isLegalNoticeApproved(notice: LegalNoticeRecord | null | undefined, revision: string = legalRevision) {
  return Boolean(notice?.approvedAt && notice.approvedRevision === revision && notice.privacyEmail && notice.serviceProviders && notice.retention);
}
