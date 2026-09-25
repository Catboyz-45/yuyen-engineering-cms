/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /admin/company สำหรับแก้ข้อมูลบริษัท ช่องทางติดต่อ รูป และข้อความบนหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ฟอร์มแบ่งเป็นกลุ่มตามตำแหน่งที่ข้อมูลไปแสดงบนหน้าเว็บ
 */
import { AdminPageHeader } from "@/components/admin-shell";
import { CompanyForm } from "@/components/company-form";

/** สร้างส่วนหน้าจอ CompanyPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default function CompanyPage() {
  return <><AdminPageHeader eyebrow="เนื้อหาหลักของเว็บไซต์" title="ข้อมูลบริษัท" description="ข้อมูลในหน้านี้แสดงในหน้าแรก เกี่ยวกับเรา ติดต่อเรา และส่วนท้ายเว็บไซต์" /><CompanyForm /></>;
}
