/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /contact; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Clock3, Facebook, Mail, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";
import { createMetadata } from "@/lib/seo";
import { ConsentMap } from "@/components/consent-map";

export const metadata = createMetadata({ title: "ติดต่อเรา", description: "ช่องทางติดต่อ ที่อยู่ เวลาทำการ โทรศัพท์ LINE และแผนที่ของอยู่เย็นเป็นสุข วิศวกรรม", path: "/contact" });
import { resolvePublicCompany } from "@/lib/company-display";
import { PublicContentService } from "@/server/services/public-content.service";
import { resolveSiteCopy } from "@/server/services/site-copy";

/** สร้างส่วนหน้าจอ ContactPage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ContactPage() {
  const record = await new PublicContentService().getCompany();
  const company = resolvePublicCompany(record);
  const copy = resolveSiteCopy(record?.siteCopy);
  const contacts = [{ icon: Phone, title: "โทรศัพท์", text: company.phoneDisplay, note: "แตะเพื่อโทรหาเรา" }, { icon: MessageCircle, title: "LINE Official", text: company.lineLabel, note: "เพิ่มเพื่อนและเริ่มแชท" }, { icon: Mail, title: "อีเมล", text: company.email, note: "สำหรับติดต่อเรื่องทั่วไป" }, { icon: Clock3, title: "เวลาทำการ", text: company.businessHours, note: "กรุณาติดต่อล่วงหน้า" }].filter(item => item.text);
  return <><section className="page-hero"><div className="container"><p className="eyebrow">CONTACT US</p><h1 className="display">ติดต่อเรา</h1>{copy.contactIntro && <p className="lead">{copy.contactIntro}</p>}</div></section><section className="section"><div className="container"><div className="grid-2"><div><div className="grid-2">{contacts.map(item => <article className="card card-body" key={item.title}><span className="icon-box"><item.icon size={22} /></span><p className="eyebrow" style={{ marginTop: 22 }}>{item.title}</p><h2 className="subheading">{item.text}</h2><p className="muted">{item.note}</p></article>)}</div><div className="cluster" style={{ marginTop: 24 }}>{company.phoneHref && <a className="btn btn-primary" href={`tel:${company.phoneHref}`}><Phone size={17} /> โทรหาเรา</a>}{company.lineUrl ? <a className="btn btn-outline" href={company.lineUrl} target="_blank" rel="noreferrer"><MessageCircle size={17} /> แชทผ่าน LINE</a> : company.isPlaceholder && <span className="btn pending-contact" title="รอเจ้าของบริษัทยืนยัน URL"><MessageCircle size={17} /> LINE รอยืนยัน</span>}{company.facebookUrl ? <a className="btn btn-ghost" href={company.facebookUrl} target="_blank" rel="noreferrer"><Facebook size={17} /> Facebook</a> : company.isPlaceholder && <span className="btn pending-contact" title="รอเจ้าของบริษัทยืนยัน URL"><Facebook size={17} /> Facebook รอยืนยัน</span>}</div></div><div className="card" style={{ minHeight: 480, background: "#dce7e1", display: "grid", placeItems: "center" }}>{company.mapsEmbedUrl ? <ConsentMap key={company.mapsEmbedUrl} embedUrl={company.mapsEmbedUrl} /> : <div style={{ textAlign: "center", padding: 28 }}><MapPin size={42} color="var(--green-700)" /><h2 className="subheading" style={{ marginTop: 15 }}>แผนที่ Google Maps</h2><p className="muted">{company.isPlaceholder ? "รอเจ้าของบริษัทยืนยันตำแหน่งและ Embed URL" : company.mapsUrl ? "เปิดเส้นทางใน Google Maps" : "สอบถามเส้นทางได้จากช่องทางติดต่อของบริษัท"}</p>{company.mapsUrl ? <a className="btn btn-dark" href={company.mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> เปิดเส้นทาง</a> : company.isPlaceholder && <span className="btn pending-contact"><Navigation size={17} /> ตำแหน่งรอยืนยัน</span>}</div>}</div></div><div className="card card-body" style={{ marginTop: 28 }}><p className="eyebrow">OFFICE ADDRESS</p><h2 className="subheading">{company.name}</h2>{(company.address || company.isPlaceholder) && <p className="lead" style={{ whiteSpace: "pre-wrap" }}><MapPin size={19} style={{ display: "inline", verticalAlign: "middle" }} /> {company.address ?? "ที่อยู่บริษัทจะแสดงหลังเจ้าของบริษัทยืนยันข้อมูลเรียบร้อย"}</p>}{company.isPlaceholder && <span className="status draft">ข้อมูลตัวอย่าง — ห้ามเผยแพร่จริง</span>}</div></div></section></>;
}
