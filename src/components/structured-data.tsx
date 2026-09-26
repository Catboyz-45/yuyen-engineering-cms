/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React structured-data ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import brandLogo from "@/assets/yuyen-logo.png";
import type { PublicCompany } from "@/lib/company-display";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th";

/** สร้างส่วนหน้าจอ StructuredData; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function StructuredData({ data }: Readonly<{ data: Record<string, unknown> }>) { return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", String.raw`\u003c`) }} />; }

/** ส่ง LocalBusiness ให้เครื่องมือค้นหาเฉพาะข้อมูลที่บริษัทกรอกใน CMS แล้ว ไม่เผยแพร่ค่าตัวอย่างหรือข้อเท็จจริงที่ยังไม่ยืนยัน */
export function LocalBusinessStructuredData({ company }: Readonly<{ company: PublicCompany }>) {
  if (company.isPlaceholder) return null;
  const data = {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HVACBusiness"],
    "@id": `${siteUrl}/#business`,
    name: company.name,
    legalName: company.legalName,
    ...(company.registrationNumber ? { taxID: company.registrationNumber } : {}),
    url: siteUrl,
    image: company.logo ? `${siteUrl}/api/media/${company.logo.id}?format=webp&width=640` : `${siteUrl}/opengraph-image`,
    logo: company.logo ? `${siteUrl}/api/media/${company.logo.id}?format=webp&width=640` : `${siteUrl}${brandLogo.src}`,
    ...(company.shortDescription ? { description: company.shortDescription } : {}),
    ...(company.phoneHref ? { telephone: company.phoneHref } : {}),
    ...(company.email ? { email: company.email } : {}),
    ...(company.address ? { address: company.address } : {}),
    priceRange: "สอบถามราคา",
  };

  return <StructuredData data={data} />;
}
