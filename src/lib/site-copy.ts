/**
 * หน้าที่ของไฟล์นี้: ข้อความบนหน้าเว็บที่บริษัทแก้ได้จากหลังบ้าน (ค่าเริ่มต้น ขีดจำกัดความยาว และชนิดข้อมูล)
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ค่าเริ่มต้นด้านล่างใช้จนกว่าบริษัทจะบันทึกข้อความเองครั้งแรก
 * ขึ้นบรรทัดใหม่ในหัวข้อได้ด้วยการกด Enter ในช่องกรอก
 */
export type CopyItem = { title: string; text: string };

export type SiteCopy = {
  heroBadge: string;
  heroTitle: string;
  heroText: string;
  highlights: CopyItem[];
  servicesHeading: string;
  productsHeading: string;
  productsText: string;
  processHeading: string;
  processSteps: CopyItem[];
  projectsHeading: string;
  newsHeading: string;
  ctaTitle: string;
  ctaText: string;
  aboutHeadline: string;
  storyHeadline: string;
  servicesIntro: string;
  productsIntro: string;
  projectsIntro: string;
  newsIntro: string;
  contactIntro: string;
  footerTagline: string;
};

export const HIGHLIGHT_LIMIT = 3;
export const PROCESS_STEP_LIMIT = 6;
export const COPY_ITEM_LIMITS = { title: 60, text: 200 } as const;

/** ช่องที่เป็นหัวข้อของส่วนต่างๆ ต้องมีข้อความเสมอ ช่องอื่นเว้นว่างเพื่อซ่อนได้ */
export const siteCopyTextFields = [
  { key: "heroBadge", label: "ป้ายเล็กบนภาพหน้าแรก", max: 80, required: false, group: "หน้าแรก" },
  { key: "heroTitle", label: "หัวข้อหน้าแรก (ใช้เมื่อไม่มีแบนเนอร์)", max: 120, required: true, group: "หน้าแรก" },
  { key: "heroText", label: "ข้อความหน้าแรก (ใช้เมื่อไม่มีแบนเนอร์)", max: 300, required: false, group: "หน้าแรก" },
  { key: "servicesHeading", label: "หัวข้อส่วนบริการ", max: 120, required: true, group: "หน้าแรก" },
  { key: "productsHeading", label: "หัวข้อส่วนสินค้า", max: 120, required: true, group: "หน้าแรก" },
  { key: "productsText", label: "คำอธิบายส่วนสินค้า", max: 300, required: false, group: "หน้าแรก" },
  { key: "processHeading", label: "หัวข้อขั้นตอนการทำงาน", max: 120, required: true, group: "หน้าแรก" },
  { key: "projectsHeading", label: "หัวข้อส่วนผลงาน", max: 120, required: true, group: "หน้าแรก" },
  { key: "newsHeading", label: "หัวข้อส่วนข่าวสาร", max: 120, required: true, group: "หน้าแรก" },
  { key: "ctaTitle", label: "หัวข้อชวนติดต่อท้ายหน้าแรก", max: 120, required: true, group: "หน้าแรก" },
  { key: "ctaText", label: "ข้อความชวนติดต่อท้ายหน้าแรก", max: 300, required: false, group: "หน้าแรก" },
  { key: "aboutHeadline", label: "หัวข้อหน้าเกี่ยวกับเรา", max: 120, required: true, group: "หน้าเกี่ยวกับเรา" },
  { key: "storyHeadline", label: "หัวข้อส่วนประวัติบริษัท", max: 120, required: true, group: "หน้าเกี่ยวกับเรา" },
  { key: "servicesIntro", label: "คำนำหน้าบริการ", max: 300, required: false, group: "คำนำหน้ารายการ" },
  { key: "productsIntro", label: "คำนำหน้าสินค้า", max: 300, required: false, group: "คำนำหน้ารายการ" },
  { key: "projectsIntro", label: "คำนำหน้าผลงาน", max: 300, required: false, group: "คำนำหน้ารายการ" },
  { key: "newsIntro", label: "คำนำหน้าข่าวสาร", max: 300, required: false, group: "คำนำหน้ารายการ" },
  { key: "contactIntro", label: "คำนำหน้าติดต่อเรา", max: 300, required: false, group: "คำนำหน้ารายการ" },
  { key: "footerTagline", label: "คำโปรยท้ายเว็บ", max: 300, required: false, group: "ท้ายเว็บ" },
] as const satisfies readonly { key: Exclude<keyof SiteCopy, "highlights" | "processSteps">; label: string; max: number; required: boolean; group: string }[];

export type SiteCopyTextKey = (typeof siteCopyTextFields)[number]["key"];

export const DEFAULT_SITE_COPY: SiteCopy = {
  heroBadge: "ดูแลโดยทีมช่างผู้มีประสบการณ์",
  heroTitle: "เย็นสบาย มั่นใจได้ในทุกพื้นที่ของคุณ",
  heroText: "ครบทุกเรื่องระบบปรับอากาศ ตั้งแต่จำหน่าย ติดตั้ง ล้าง ซ่อมบำรุง ไปจนถึงงานระบบ M&E",
  highlights: [
    { title: "มาตรฐาน", text: "ใส่ใจทุกขั้นตอนการทำงาน" },
    { title: "ตรงเวลา", text: "นัดหมายชัดเจน ทำงานเป็นระบบ" },
    { title: "ดูแลต่อเนื่อง", text: "พร้อมให้คำแนะนำหลังส่งมอบ" },
  ],
  servicesHeading: "บริการที่ดูแลได้ครบ\nตั้งแต่ต้นจนจบ",
  productsHeading: "สินค้าที่คัดสรรเพื่อพื้นที่ของคุณ",
  productsText: "เลือกดูตามยี่ห้อ ประเภท และขนาด BTU พร้อมให้ทีมงานช่วยแนะนำรุ่นที่เหมาะสม",
  processHeading: "ทุกงานเริ่มจากความเข้าใจ\nและจบด้วยความเรียบร้อย",
  processSteps: [
    { title: "รับข้อมูล", text: "รับฟังความต้องการและรายละเอียดพื้นที่เบื้องต้น" },
    { title: "สำรวจหน้างาน", text: "ตรวจสอบพื้นที่จริงและประเมินแนวทางที่เหมาะสม" },
    { title: "เสนอแนวทาง", text: "อธิบายขอบเขตงาน อุปกรณ์ และระยะเวลาดำเนินการ" },
    { title: "ติดตั้งและดูแล", text: "ดำเนินงานตามมาตรฐาน พร้อมตรวจเช็กก่อนส่งมอบ" },
  ],
  projectsHeading: "ผลงานที่เราภูมิใจ",
  newsHeading: "ข่าวสารและสาระน่ารู้",
  ctaTitle: "กำลังมองหาทีมดูแลระบบปรับอากาศ?",
  ctaText: "พูดคุยกับเราเพื่อรับคำแนะนำเบื้องต้นโดยไม่มีค่าใช้จ่าย",
  aboutHeadline: "งานวิศวกรรมที่ดี\nเริ่มจากความใส่ใจ",
  storyHeadline: "อยู่เย็น เป็นสุข\nในทุกพื้นที่ใช้งาน",
  servicesIntro: "ดูแลระบบปรับอากาศและงานวิศวกรรมอย่างครบวงจร พร้อมแนะนำแนวทางที่เหมาะสมกับแต่ละพื้นที่",
  productsIntro: "เลือกดูสินค้าตามยี่ห้อ ประเภท และขนาด BTU หากไม่แน่ใจ ทีมงานพร้อมช่วยแนะนำรุ่นที่เหมาะกับพื้นที่",
  projectsIntro: "ตัวอย่างงานติดตั้ง บำรุงรักษา และงานระบบวิศวกรรมที่ได้รับการดูแลอย่างเป็นขั้นตอน",
  newsIntro: "ติดตามข่าวบริษัท กิจกรรม โปรโมชัน และสาระเกี่ยวกับการดูแลระบบปรับอากาศ",
  contactIntro: "พูดคุยกับทีมงานเพื่อสอบถามข้อมูลสินค้า บริการ หรือขอคำแนะนำเบื้องต้น",
  footerTagline: "ดูแลทุกเรื่องระบบปรับอากาศและงานวิศวกรรม ด้วยบริการที่ตรงไปตรงมาและใส่ใจในระยะยาว",
};
