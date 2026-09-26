/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /contact; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import { Clock3, Mail, MapPin, MessageCircle, Navigation, Phone, Users, type LucideIcon } from "lucide-react";
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
  return <><section className="page-hero"><div className="container"><p className="eyebrow">CONTACT US</p><h1 className="display">ติดต่อเรา</h1>{copy.contactIntro && <p className="lead">{copy.contactIntro}</p>}</div></section><section className="section"><div className="container"><div className="grid-2"><div><div className="grid-2">{contacts.map(item => <article className="card card-body" key={item.title}><span className="icon-box"><item.icon size={22} /></span><p className="eyebrow" style={{ marginTop: 22 }}>{item.title}</p><h2 className="subheading contact-value">{item.text}</h2><p className="muted">{item.note}</p></article>)}</div><div className="cluster" style={{ marginTop: 24 }}>{company.phoneHref && <a className="btn btn-primary" href={`tel:${company.phoneHref}`}><Phone size={17} /> โทรหาเรา</a>}<ExternalContact href={company.lineUrl} pending={company.isPlaceholder} icon={MessageCircle} className="btn-outline" label="แชทผ่าน LINE" pendingLabel="LINE รอยืนยัน" /><ExternalContact href={company.facebookUrl} pending={company.isPlaceholder} icon={Users} className="btn-ghost" label="Facebook" pendingLabel="Facebook รอยืนยัน" /></div></div><div className="card" style={{ minHeight: 480, background: "#dce7e1", display: "grid", placeItems: "center" }}>{company.mapsEmbedUrl ? <ConsentMap key={company.mapsEmbedUrl} embedUrl={company.mapsEmbedUrl} /> : <div style={{ textAlign: "center", padding: 28 }}><MapPin size={42} color="var(--green-700)" style={{ margin: "0 auto" }} aria-hidden="true" /><h2 className="subheading" style={{ marginTop: 15 }}>แผนที่ Google Maps</h2><p className="muted">{mapNote(company)}</p>{company.mapsUrl ? <a className="btn btn-dark" href={company.mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} /> เปิดเส้นทาง</a> : company.isPlaceholder && <span className="btn pending-contact"><Navigation size={17} /> ตำแหน่งรอยืนยัน</span>}</div>}</div></div><div className="card card-body" style={{ marginTop: 28 }}><p className="eyebrow">OFFICE ADDRESS</p><h2 className="subheading">{company.name}</h2>{(company.address || company.isPlaceholder) && <p className="lead" style={{ whiteSpace: "pre-wrap" }}><MapPin size={19} style={{ display: "inline", verticalAlign: "middle" }} /> {company.address ?? "ที่อยู่บริษัทจะแสดงหลังเจ้าของบริษัทยืนยันข้อมูลเรียบร้อย"}</p>}{company.isPlaceholder && <span className="status draft">ข้อมูลตัวอย่าง — ห้ามเผยแพร่จริง</span>}</div></div></section></>;
}

function mapNote(company: { isPlaceholder: boolean; mapsUrl: string | null }) {
  if (company.isPlaceholder) return "รอเจ้าของบริษัทยืนยันตำแหน่งและ Embed URL";
  return company.mapsUrl ? "เปิดเส้นทางใน Google Maps" : "สอบถามเส้นทางได้จากช่องทางติดต่อของบริษัท";
}

/** ปุ่มไปช่องทางภายนอก; ระหว่างใช้ข้อมูลตัวอย่างแสดงป้าย "รอยืนยัน" แทนลิงก์ */
function ExternalContact({ href, pending, icon: Icon, className, label, pendingLabel }: Readonly<{ href: string | null; pending: boolean; icon: LucideIcon; className: string; label: string; pendingLabel: string }>) {
  if (href) return <a className={`btn ${className}`} href={href} target="_blank" rel="noreferrer"><Icon size={17} /> {label}</a>;
  if (!pending) return null;
  return <span className="btn pending-contact" title="รอเจ้าของบริษัทยืนยัน URL"><Icon size={17} /> {pendingLabel}</span>;
}
