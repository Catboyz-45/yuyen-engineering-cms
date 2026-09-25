/** หน้าที่ของไฟล์นี้: ทำให้นโยบายเปิดอ่านได้โดยไม่ต้องล็อกอินและไม่ต้องเชื่อมฐานข้อมูล */
import { resolvePublicCompany } from "@/lib/company-display";
import { PublicContentService } from "@/server/services/public-content.service";
import type { Metadata } from "next";
import { PublicShell } from "@/components/site-shell";
import { getLegalSettings } from "@/server/config/legal";

export const dynamic = "force-dynamic";

/** ฉบับร่างยังเข้าถึงผ่านลิงก์ได้ แต่ไม่ให้เครื่องมือค้นหานำไปแสดงเป็นนโยบายฉบับรับรอง */
export function generateMetadata(): Metadata {
  return { robots: { index: getLegalSettings().LEGAL_NOTICE_APPROVED === "true", follow: true } };
}

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  // ใช้ข้อมูลบริษัทและบริการชุดเดียวกับหน้าเว็บหลัก เพื่อไม่ให้ footer ของหน้านโยบายแสดงค่าตัวอย่าง
  const content = new PublicContentService();
  const [record, services] = await Promise.all([content.getCompany(), content.listServices()]);
  return <PublicShell company={resolvePublicCompany(record)} services={services.map(service => ({ title: service.title, slug: service.slug }))}>{children}</PublicShell>;
}
