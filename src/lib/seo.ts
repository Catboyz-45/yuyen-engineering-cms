/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ seo ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import type { Metadata } from "next";

const siteName = "อยู่เย็นเป็นสุข วิศวกรรม";

/** สร้างข้อมูล SEO มาตรฐานของหน้าสาธารณะจากชื่อ คำอธิบาย และ path */
export function createMetadata({
  title,
  description,
  path,
  type = "website",
  image,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  image?: string;
  /** true เมื่อ title เป็นชื่อเต็มจากผู้ดูแลแล้ว ไม่ต้องต่อท้ายชื่อเว็บ */
  absoluteTitle?: boolean;
}): Metadata {
  const fullTitle = absoluteTitle ? title : `${title} | ${siteName}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type,
      locale: "th_TH",
      siteName,
      title: fullTitle,
      description,
      url: path,
      images: [{ url: image ?? "/opengraph-image", width: 1200, height: 630, alt: `${title} — ${siteName}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image ?? "/opengraph-image"],
    },
  };
}
