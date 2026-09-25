/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/legal ให้ Super Admin ยืนยันข้อมูลในหน้านโยบายและรับรองประกาศใช้
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ข้อความหลักของนโยบายอยู่ในโค้ดเพราะอธิบายการทำงานของระบบ หน้านี้ตั้งเฉพาะข้อมูลที่บริษัทต้องยืนยัน
 */
import { AdminPageHeader } from "@/components/admin-shell";
import { LegalNoticeForm } from "@/components/legal-notice-form";
import { requireAdmin } from "@/server/auth/session";

export default async function LegalNoticePage() {
  await requireAdmin(["SUPER_ADMIN"]);
  return <><AdminPageHeader title="นโยบายเว็บไซต์" description="ข้อมูลที่บริษัทต้องยืนยันในนโยบายความเป็นส่วนตัว คุกกี้ และเงื่อนไขการใช้เว็บไซต์ ก่อนประกาศใช้จริง" /><section className="panel"><LegalNoticeForm /></section></>;
}
