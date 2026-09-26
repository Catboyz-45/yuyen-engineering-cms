/**
 * หน้าที่ของไฟล์นี้: โครงหน้าร่วมของเส้นทางย่อยในโฟลเดอร์นี้ ใช้ครอบเนื้อหาและกำหนดส่วนที่แสดงซ้ำโดยไม่ต้องเขียนใหม่ทุกหน้า
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { Metadata } from "next";
import { PublicShell } from "@/components/site-shell";
import { RevealOnScroll } from "@/components/reveal-on-scroll";
import { LocalBusinessStructuredData } from "@/components/structured-data";
import { PublicContentService } from "@/server/services/public-content.service";
import { resolvePublicCompany } from "@/lib/company-display";
import { resolveSiteCopy } from "@/server/services/site-copy";

export const dynamic = "force-dynamic";

/** ชื่อบริษัทและคำอธิบาย SEO จาก CMS เป็นค่าเริ่มต้นของทุกหน้าสาธารณะ */
export async function generateMetadata(): Promise<Metadata> {
  const company = await new PublicContentService().getCompany();
  const name = company?.displayName?.trim();
  const description = company?.seoDescription?.trim();
  return {
    ...(name ? { title: { default: name, template: `%s | ${name}` }, applicationName: name } : {}),
    ...(description ? { description } : {}),
  };
}

/** สร้างส่วนหน้าจอ PublicLayout; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = new PublicContentService();
  const [record, services] = await Promise.all([content.getCompany(), content.listServices()]);
  const company = resolvePublicCompany(record);
  return <><LocalBusinessStructuredData company={company} /><PublicShell company={company} services={services.map(service => ({ title: service.title, slug: service.slug }))} tagline={resolveSiteCopy(record?.siteCopy).footerTagline}>{children}</PublicShell><RevealOnScroll /></>;
}
