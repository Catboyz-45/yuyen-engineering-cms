/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /products/[slug]; เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, MessageCircle } from "lucide-react";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { MediaGallery } from "@/components/media-gallery";
import { DetailNav } from "@/components/detail-nav";
import { galleryImages } from "@/lib/gallery";
import { redirectOldSlug } from "@/server/services/public-redirect.service";
import { StructuredData } from "@/components/structured-data";
const content = new PublicContentService();
/** สร้าง title/description/canonical URL สำหรับหน้ารายละเอียดจากข้อมูลที่เผยแพร่; ถ้าไม่พบจะใช้ค่าเริ่มต้นที่ปลอดภัย */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const item = await content.getProduct((await params).slug); return item ? createMetadata({ title: item.seoTitle ?? item.name, description: item.seoDescription ?? item.summary, path: `/products/${item.slug}`, image: item.coverMedia ? `/api/media/${item.coverMedia.id}?format=webp&width=1280` : undefined }) : {}; }
/** สร้างส่วนหน้าจอ ProductDetail; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function ProductDetail({ params }: Readonly<{ params: Promise<{ slug: string }> }>) { const { slug } = await params; const item = await content.getProduct(slug); if (!item) { await redirectOldSlug(`/products/${slug}`, value => content.getProduct(value)); notFound(); } const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.yuyenengineering.co.th"; return <><StructuredData data={{ "@context": "https://schema.org", "@type": "Product", name: item.name, model: item.model, description: item.summary, brand: { "@type": "Brand", name: item.brand.name }, url: `${siteUrl}/products/${item.slug}` }} /><section className="section"><div className="container"><DetailNav href="/products" rootLabel="สินค้า" trail={[item.brand.name, item.name]} /><div className="detail-grid"><MediaGallery images={galleryImages(item.coverMedia, item.gallery)} label={`รูปสินค้า ${item.name}`} /><div><span className="tag">{item.brand.name}</span><h1 className="heading">{item.name}</h1><p className="lead">{item.summary}</p><div className="spec-list"><div className="spec"><span className="muted">รุ่น</span><strong>{item.model}</strong></div><div className="spec"><span className="muted">ประเภท</span><strong>{item.productType.name}</strong></div><div className="spec"><span className="muted">ขนาดความเย็น</span><strong>{item.btuMin ?? "–"}–{item.btuMax ?? "–"} BTU</strong></div><div className="spec"><span className="muted">ราคา</span><strong>{item.priceLabel}</strong></div></div><div style={{ whiteSpace: "pre-wrap", marginTop: 24 }}>{item.content}</div><div className="cluster" style={{ marginTop: 30 }}><Link className="btn btn-primary" href="/contact"><MessageCircle size={18} /> สอบถามสินค้านี้</Link>{item.catalogMedia && <a className="btn btn-outline" href={`/api/catalogs/${item.slug}`}><Download size={17} /> ดาวน์โหลดแคตตาล็อก PDF</a>}</div></div></div></div></section></>; }
