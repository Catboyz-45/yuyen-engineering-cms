/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React content-cards ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ResponsiveMedia } from "./responsive-media";
import { ServiceIcon } from "./service-icon";
import type { ServiceIconKey } from "@/lib/service-icons";

type CardMedia = { id: string; altText?: string | null; width?: number | null; height?: number | null } | null;

/** การ์ดบริการ: แสดงรูปปกเมื่อหน้าส่งมาให้ ถ้าไม่มีใช้ไอคอนเส้นของบริการนั้น */
export function ServiceCard({ item }: Readonly<{ item: { slug: string; title: string; eyebrow: string; description: string; icon: ServiceIconKey; media?: CardMedia } }>) {
  return <Link href={`/services/${item.slug}`} className="card card-hover service-card">{item.media && <ResponsiveMedia media={item.media} />}<div className="card-body">{!item.media && <span className="line-icon"><ServiceIcon name={item.icon} /></span>}<p className="eyebrow">{item.eyebrow}</p><h3 className="subheading">{item.title}</h3><p className="muted">{item.description}</p><span className="card-more">ดูรายละเอียด <ArrowUpRight size={17} aria-hidden="true" /></span></div></Link>;
}

/** สร้างส่วนหน้าจอ ProductCard; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function ProductCard({ item }: Readonly<{ item: { slug: string; name: string; brand: string; type: string; btu: string; feature: string; tone: string; media?: CardMedia } }>) {
  return <Link href={`/products/${item.slug}`} className="card card-hover"><ResponsiveMedia media={item.media} fallbackClass={item.tone} /><div className="card-body"><div className="cluster"><span className="tag">{item.brand}</span><span className="muted" style={{ fontSize: ".8rem" }}>{item.type}</span></div><h3 className="subheading" style={{ marginTop: 16 }}>{item.name}</h3><p className="muted">{item.btu} · {item.feature}</p><span className="cluster" style={{ color: "var(--green-700)", fontWeight: 750, marginTop: 18 }}>ดูรายละเอียด <ArrowUpRight size={17} /></span></div></Link>;
}

/** สร้างส่วนหน้าจอ StoryCard; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function StoryCard({ item, type }: Readonly<{ item: { slug: string; title: string; tone: string; category: string; date?: string; area?: string; summary?: string; media?: CardMedia }; type: "projects" | "news" }>) {
  return <Link href={`/${type}/${item.slug}`} className="card card-hover"><ResponsiveMedia media={item.media} fallbackClass={item.tone} /><div className="card-body"><span className="tag">{item.category}</span><h3 className="subheading" style={{ marginTop: 16 }}>{item.title}</h3>{item.summary && <p className="muted">{item.summary}</p>}<p className="muted" style={{ fontSize: ".82rem", marginBottom: 0 }}>{item.area ?? item.date}</p></div></Link>;
}
