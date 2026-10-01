/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /about; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { BadgeCheck, HeartHandshake, ShieldCheck } from "lucide-react";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { resolveSiteCopy } from "@/server/services/site-copy";
import { MediaGallery } from "@/components/media-gallery";

export const metadata = createMetadata({ title: "เกี่ยวกับเรา", description: "รู้จักบริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด วิสัยทัศน์ พันธกิจ และแนวทางการทำงาน", path: "/about" });

// ข้อความตัวอย่างใช้เฉพาะก่อนบริษัทบันทึกข้อมูลใน CMS ครั้งแรก
const sample = {
  shortDescription: "เราให้บริการระบบปรับอากาศและงานระบบอาคาร โดยยึดความเหมาะสมของพื้นที่ ความปลอดภัย และการดูแลในระยะยาวเป็นสำคัญ",
  history: "บริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด ก่อตั้งขึ้นจากความตั้งใจที่จะทำให้งานระบบปรับอากาศเป็นเรื่องเข้าใจง่าย",
  vision: "เป็นทีมวิศวกรรมที่ลูกค้าไว้วางใจ",
  mission: "ส่งมอบงานที่เหมาะกับผู้ใช้งาน โปร่งใส และรับผิดชอบ",
  values: "จริงใจ เป็นระบบ ปลอดภัย และพร้อมพัฒนาคุณภาพงานอย่างต่อเนื่อง",
};

/** สร้างส่วนหน้าจอ AboutPage; เมื่อมีข้อมูลบริษัทใน CMS แล้วจะแสดงเฉพาะส่วนที่กรอกไว้ */
export default async function AboutPage() {
  const company = await new PublicContentService().getCompany();
  const siteCopy = resolveSiteCopy(company?.siteCopy);
  const copy = company ? { shortDescription: company.shortDescription, history: company.history, vision: company.vision, mission: company.mission, values: company.values } : sample;
  const images = company?.gallery.map(entry => entry.media) ?? [];
  const principles = [
    { title: "วิสัยทัศน์", text: copy.vision, icon: BadgeCheck },
    { title: "พันธกิจ", text: copy.mission, icon: HeartHandshake },
    { title: "คุณค่าของเรา", text: copy.values, icon: ShieldCheck },
  ].filter(item => item.text?.trim());
  const showImage = images.length > 0 || !company;
  return <>
    <section className="page-hero"><div className="container"><p className="eyebrow">ABOUT US</p><h1 className="display pre-line">{siteCopy.aboutHeadline}</h1>{copy.shortDescription && <p className="lead">{copy.shortDescription}</p>}</div></section>
    {(copy.history || showImage) && <section className="section"><div className={showImage ? "container detail-grid" : "container"}>
      {images.length > 0 ? <MediaGallery images={images} label="รูปบริษัท" /> : showImage && <div className="media office media-office" style={{ minHeight: 470, borderRadius: 24 }}><span className="sr-only">ภาพสำนักงานบริษัท (ภาพตัวอย่าง)</span></div>}
      {copy.history && <div><p className="eyebrow">OUR STORY</p><h2 className="heading pre-line">{siteCopy.storyHeadline}</h2><p className="lead" style={{ whiteSpace: "pre-wrap" }}>{copy.history}</p></div>}
    </div></section>}
    {principles.length > 0 && <section className="section band"><div className="container"><div className="grid-3">{principles.map(item => <article className="process-item" key={item.title}><item.icon color="var(--lime-400)" /><h2>{item.title}</h2><p style={{ whiteSpace: "pre-wrap" }}>{item.text}</p></article>)}</div></div></section>}
  </>;
}
