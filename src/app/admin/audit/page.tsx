/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/audit ตรวจสิทธิ์ Super Admin ฝั่งเซิร์ฟเวอร์ก่อนแสดงประวัติการทำงาน
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: Editor ที่เปิดลิงก์นี้ตรงๆ จะถูกพากลับหน้าภาพรวม
 */
import { AuditLog } from "@/components/audit-log";
import { requireAdmin } from "@/server/auth/session";

export default async function AuditPage() {
  await requireAdmin(["SUPER_ADMIN"]);
  return <AuditLog />;
}
