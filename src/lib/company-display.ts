/**
 * หน้าที่ของไฟล์นี้: ตัดสินว่าหน้าเว็บจะแสดงข้อมูลบริษัทค่าใด จากข้อมูลใน CMS หรือค่าตัวอย่างก่อนบริษัทกรอกครั้งแรก
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: เมื่อบันทึกข้อมูลบริษัทในหลังบ้านแล้ว ช่องที่เว้นว่างจะถูกซ่อน ไม่ย้อนกลับไปใช้ค่าตัวอย่าง
 */
import { companyPublicConfig } from "./public-config";

type CompanyRecord = {
  displayName?: string | null;
  shortDescription?: string | null;
  phoneDisplay?: string | null;
  phoneHref?: string | null;
  email?: string | null;
  lineLabel?: string | null;
  lineUrl?: string | null;
  facebookUrl?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  mapsEmbedUrl?: string | null;
  businessHours?: string | null;
  logoMedia?: { id: string; altText?: string | null } | null;
};

export type PublicCompany = {
  name: string;
  shortDescription: string | null;
  phoneDisplay: string | null;
  phoneHref: string | null;
  email: string | null;
  lineLabel: string | null;
  lineUrl: string | null;
  facebookUrl: string | null;
  address: string | null;
  mapsUrl: string | null;
  mapsEmbedUrl: string | null;
  businessHours: string | null;
  logo: { id: string; altText: string } | null;
  /** true เฉพาะเมื่อยังไม่มีข้อมูลบริษัทใน CMS และกำลังแสดงค่าตัวอย่าง */
  isPlaceholder: boolean;
};

function text(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** ค่าจาก CMS มีผลเสมอเมื่อมีแถวบริษัทแล้ว ค่าตัวอย่าง/ENV ใช้เฉพาะก่อนบันทึกครั้งแรก */
export function resolvePublicCompany(record: CompanyRecord | null | undefined): PublicCompany {
  if (!record) {
    const fallback = companyPublicConfig;
    return { name: fallback.name, shortDescription: null, phoneDisplay: fallback.phoneDisplay, phoneHref: fallback.phoneHref, email: fallback.email, lineLabel: fallback.lineLabel, lineUrl: fallback.lineUrl, facebookUrl: fallback.facebookUrl, address: fallback.address, mapsUrl: fallback.mapsUrl, mapsEmbedUrl: fallback.mapsEmbedUrl, businessHours: fallback.businessHours, logo: null, isPlaceholder: true };
  }
  return {
    name: text(record.displayName) ?? companyPublicConfig.name,
    shortDescription: text(record.shortDescription),
    phoneDisplay: text(record.phoneDisplay),
    phoneHref: text(record.phoneHref),
    email: text(record.email),
    lineLabel: text(record.lineLabel),
    lineUrl: text(record.lineUrl),
    facebookUrl: text(record.facebookUrl),
    address: text(record.address),
    mapsUrl: text(record.mapsUrl),
    mapsEmbedUrl: text(record.mapsEmbedUrl),
    businessHours: text(record.businessHours),
    logo: record.logoMedia ? { id: record.logoMedia.id, altText: text(record.logoMedia.altText) ?? "" } : null,
    isPlaceholder: false,
  };
}
