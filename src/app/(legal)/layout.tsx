/** หน้าที่ของไฟล์นี้: ทำให้นโยบายเปิดอ่านได้โดยไม่ต้องล็อกอิน และยังเปิดได้แม้ฐานข้อมูลขัดข้อง */
import { resolvePublicCompany } from "@/lib/company-display";
import { resolveSiteCopy } from "@/server/services/site-copy";
import { PublicContentService } from "@/server/services/public-content.service";
import type { Metadata } from "next";
import { PublicShell } from "@/components/site-shell";
import { getPublicLegalNotice } from "@/server/services/legal-notice.service";
import { errorDetails, log } from "@/server/observability/logger";

export const dynamic = "force-dynamic";

/** ฉบับร่างยังเข้าถึงผ่านลิงก์ได้ แต่ไม่ให้เครื่องมือค้นหานำไปแสดงเป็นนโยบายฉบับรับรอง */
export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: (await getPublicLegalNotice()).approved, follow: true } };
}

export default async function LegalLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // ใช้ข้อมูลบริษัทและบริการชุดเดียวกับหน้าเว็บหลัก เพื่อไม่ให้ footer ของหน้านโยบายแสดงค่าตัวอย่าง
  const content = new PublicContentService();
  const loaded = await Promise.all([content.getCompany(), content.listServices()]).catch(error => {
    log("error", "legal_layout_content_unavailable", errorDetails(error));
    return null;
  });
  // ฐานข้อมูลขัดข้องยังต้องอ่านนโยบายได้: แสดงส่วนท้ายที่มีแค่ชื่อบริษัท ไม่ใช้ข้อมูลติดต่อตัวอย่าง
  const [record, services] = loaded ?? [null, []];
  const company = loaded ? resolvePublicCompany(record) : resolvePublicCompany({});
  return <PublicShell company={company} services={services.map(service => ({ title: service.title, slug: service.slug }))} tagline={resolveSiteCopy(record?.siteCopy).footerTagline}>{children}</PublicShell>;
}
