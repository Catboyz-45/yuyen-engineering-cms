/**
 * หน้าที่ของไฟล์นี้: ฟังก์ชันช่วยเหลือ public-config ที่รวมตรรกะใช้ซ้ำและไม่มีหน้าจอเป็นของตัวเอง
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
/**
 * ค่าจาก ENV ใช้ได้ทุกสภาพแวดล้อม ส่วนเบอร์/อีเมล/LINE ตัวอย่างใช้เฉพาะเครื่องพัฒนาและทดสอบ
 * production ที่ยังไม่บันทึกข้อมูลบริษัทจะซ่อนช่องนั้นแทนการแสดงข้อมูลติดต่อปลอม
 */
export function publicValue(value: string | undefined, sample: string, nodeEnv = process.env.NODE_ENV): string | null {
  const normalized = value?.trim();
  if (normalized) return normalized;
  return nodeEnv === "production" ? null : sample;
}

export const companyPublicConfig = {
  name: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด",
  phoneDisplay: publicValue(process.env.NEXT_PUBLIC_COMPANY_PHONE_DISPLAY, "02-000-0000"),
  phoneHref: publicValue(process.env.NEXT_PUBLIC_COMPANY_PHONE_HREF, "+6620000000"),
  email: publicValue(process.env.NEXT_PUBLIC_COMPANY_EMAIL, "contact@example.co.th"),
  lineLabel: publicValue(process.env.NEXT_PUBLIC_COMPANY_LINE_LABEL, "@yuyenengineering"),
  lineUrl: process.env.NEXT_PUBLIC_COMPANY_LINE_URL?.trim() || null,
  facebookUrl: process.env.NEXT_PUBLIC_COMPANY_FACEBOOK_URL?.trim() || null,
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS?.trim() || null,
  mapsUrl: process.env.NEXT_PUBLIC_COMPANY_MAPS_URL?.trim() || null,
  mapsEmbedUrl: process.env.NEXT_PUBLIC_COMPANY_MAPS_EMBED_URL?.trim() || null,
  businessHours: publicValue(undefined, "จันทร์–เสาร์ 08:00–17:00 น."),
  isPlaceholder: !process.env.NEXT_PUBLIC_COMPANY_ADDRESS,
} as const;
