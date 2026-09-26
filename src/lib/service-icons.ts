/**
 * หน้าที่ของไฟล์นี้: รายการไอคอนที่เลือกได้สำหรับการ์ดบริการ และการเดาไอคอนจากชื่อบริการเมื่อยังไม่ได้เลือก
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ชื่อไอคอนต้องตรงกับ enum ServiceIcon ในฐานข้อมูล
 * ถ้าผู้ดูแลไม่เลือก ระบบดูจากชื่อ ข้อความเล็กเหนือชื่อ และ slug ของบริการ ตามลำดับกฎด้านล่าง
 */
export const SERVICE_ICONS = [
  { key: "AIR_VENT", label: "เครื่องปรับอากาศ" },
  { key: "SNOWFLAKE", label: "ระบบทำความเย็น" },
  { key: "DROPLETS", label: "ล้างและทำความสะอาด" },
  { key: "WRENCH", label: "ซ่อมแซม" },
  { key: "CLIPBOARD_CHECK", label: "ตรวจเช็กและบำรุงรักษา" },
  { key: "BUILDING", label: "งานระบบอาคาร" },
  { key: "ZAP", label: "ระบบไฟฟ้า" },
  { key: "FAN", label: "ระบายอากาศ" },
  { key: "THERMOMETER", label: "ตรวจวัดอุณหภูมิ" },
  { key: "HARD_HAT", label: "งานโครงการ" },
] as const;

export type ServiceIconKey = (typeof SERVICE_ICONS)[number]["key"];
export const SERVICE_ICON_KEYS = SERVICE_ICONS.map(item => item.key) as [ServiceIconKey, ...ServiceIconKey[]];

// กฎแรกที่ตรงชนะ งานซ่อมมาก่อนงานตรวจ เพราะ "ตรวจเช็กและซ่อมแซม" คืองานซ่อม
const GUESSES: [RegExp, ServiceIconKey][] = [
  [/ซ่อม|repair|fix/i, "WRENCH"],
  [/ล้าง|clean|wash/i, "DROPLETS"],
  [/m&e|งานระบบ|อาคาร|engineer|building/i, "BUILDING"],
  [/ไฟฟ้า|electric/i, "ZAP"],
  [/ระบายอากาศ|พัดลม|ventilat|fan/i, "FAN"],
  [/ตรวจ|บำรุง|inspect|mainten/i, "CLIPBOARD_CHECK"],
  [/ห้องเย็น|ทำความเย็น|chiller|cold/i, "SNOWFLAKE"],
  [/โครงการ|project/i, "HARD_HAT"],
];

/** ไอคอนที่เลือกไว้ หรือเดาจากชื่อบริการเมื่อยังไม่ได้เลือก (ไม่ตรงกฎใดใช้รูปเครื่องปรับอากาศ) */
export function resolveServiceIcon(service: { icon?: string | null; title: string; eyebrow?: string | null; slug?: string | null }): ServiceIconKey {
  const chosen = SERVICE_ICON_KEYS.find(key => key === service.icon);
  if (chosen) return chosen;
  const text = [service.title, service.eyebrow, service.slug?.replaceAll("-", " ")].filter(Boolean).join(" ");
  return GUESSES.find(([pattern]) => pattern.test(text))?.[1] ?? "AIR_VENT";
}
