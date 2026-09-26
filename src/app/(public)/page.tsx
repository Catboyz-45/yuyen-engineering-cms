/**
 * หน้าที่ของไฟล์นี้: หน้าเว็บเส้นทาง /(public); เตรียมข้อมูลที่จำเป็นแล้วประกอบส่วนติดต่อผู้ใช้ที่ผู้เยี่ยมชมหรือผู้ดูแลเห็น
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Headphones, MapPin, Phone, ShieldCheck } from "lucide-react";
import { ProductCard, ServiceCard, StoryCard } from "@/components/content-cards";
import { SectionLink } from "@/components/site-shell";
import { createMetadata } from "@/lib/seo";
import { PublicContentService } from "@/server/services/public-content.service";
import { ResponsiveMedia } from "@/components/responsive-media";
import { formatThaiDate } from "@/lib/date";
import { resolvePublicCompany } from "@/lib/company-display";
import { resolveSiteCopy } from "@/server/services/site-copy";
import { TypingHeadline } from "@/components/type-text";

/** SEO ของหน้าแรกมาจากช่อง SEO ในข้อมูลบริษัท ถ้าเว้นว่างใช้ค่าเริ่มต้น */
export async function generateMetadata() {
  const company = await new PublicContentService().getCompany();
  const seoTitle = company?.seoTitle?.trim();
  return createMetadata({ title: seoTitle || "หน้าแรก", absoluteTitle: Boolean(seoTitle), description: company?.seoDescription?.trim() || "บริการจำหน่าย ติดตั้ง ล้าง และซ่อมบำรุงระบบปรับอากาศ พร้อมงานระบบ M&E", path: "/" });
}
export const dynamic = "force-dynamic";

/** สร้างส่วนหน้าจอ HomePage; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export default async function HomePage() {
  const content = new PublicContentService();
  const [serviceRecords, productResult, projectRecords, newsResult, banner, companyRecord] = await Promise.all([content.listServices(), content.listProducts({ pageSize: 4 }), content.listProjects({ pageSize: 3 }), content.listNews({ pageSize: 3 }), content.getHomeBanner(), content.getCompany()]);
  const company = resolvePublicCompany(companyRecord);
  const copy = resolveSiteCopy(companyRecord?.siteCopy);
  const highlightIcons = [ShieldCheck, Clock3, Headphones];
  const services = serviceRecords.slice(0, 4).map(item => ({ slug: item.slug, title: item.title, eyebrow: item.eyebrow ?? "SERVICE", description: item.summary, icon: "snowflake" }));
  const products = productResult.items.map(item => ({ slug: item.slug, name: item.name, brand: item.brand.name, type: item.productType.name, btu: item.btuMin && item.btuMax ? `${item.btuMin.toLocaleString()}–${item.btuMax.toLocaleString()} BTU` : "สอบถามขนาด", feature: item.summary, tone: "silver", media: item.coverMedia }));
  const projects = projectRecords.items.map(item => ({ slug: item.slug, title: item.title, category: item.projectType, area: item.area, summary: item.summary, tone: "office", media: item.coverMedia }));
  const news = newsResult.items.map(item => ({ slug: item.slug, title: item.title, category: item.category.name, date: formatThaiDate(item.publishedAt), summary: item.summary, tone: "mint", media: item.coverMedia }));
  return (
    <>
      <section className="hero">
        {banner?.image && <ResponsiveMedia media={banner.image} className="hero-media" priority />}
        <div className="container"><div className="hero-content">
          {copy.heroBadge && <span className="hero-badge"><BadgeCheck size={16} /> {copy.heroBadge}</span>}
          <TypingHeadline className="display pre-line" text={banner?.title ?? copy.heroTitle} />
          {(banner?.description ?? copy.heroText) && <p className="lead">{banner?.description ?? copy.heroText}</p>}
          <div className="cluster" style={{ marginTop: 32 }}><HeroButton label={banner?.buttonLabel} href={banner?.buttonUrl} /><Link className="btn btn-outline" style={{ borderColor: "rgba(255,255,255,.4)", color: "white" }} href="/contact"><Phone size={17} /> ติดต่อสอบถาม</Link></div>
        </div></div>
      </section>

      {copy.highlights.length > 0 && <div className="container hero-stats">
        <div className="stats-card">
          {copy.highlights.map((item, index) => { const Icon = highlightIcons[index % highlightIcons.length]; return <div className="stat" key={`${item.title}|${item.text}`}><span className="icon-box"><Icon size={22} /></span><div><strong>{item.title}</strong>{item.text && <span>{item.text}</span>}</div></div>; })}
        </div>
      </div>}

      <section className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">OUR SERVICES</p><h2 className="heading pre-line">{copy.servicesHeading}</h2></div><SectionLink href="/services">ดูบริการทั้งหมด</SectionLink></div><div className="grid-4">{services.map(item => <ServiceCard key={item.slug} item={item} />)}</div></div></section>

      <section className="section" style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><div><p className="eyebrow">RECOMMENDED PRODUCTS</p><h2 className="heading pre-line">{copy.productsHeading}</h2>{copy.productsText && <p className="lead">{copy.productsText}</p>}</div><SectionLink href="/products">ดูสินค้าทั้งหมด</SectionLink></div><div className="grid-4">{products.map(item => <ProductCard key={item.slug} item={item} />)}</div></div></section>

      <section className="section band"><div className="container"><div className="section-head"><div><p className="eyebrow" style={{ color: "var(--lime-400)" }}>HOW WE WORK</p><h2 className="heading pre-line">{copy.processHeading}</h2></div></div>{copy.processSteps.length > 0 && <div className="process">{copy.processSteps.map(step => <div className="process-item" key={`${step.title}|${step.text}`}><h3>{step.title}</h3>{step.text && <p>{step.text}</p>}</div>)}</div>}</div></section>

      <section className="section"><div className="container"><div className="section-head"><div><p className="eyebrow">OUR PROJECTS</p><h2 className="heading pre-line">{copy.projectsHeading}</h2></div><SectionLink href="/projects">ดูผลงานทั้งหมด</SectionLink></div><div className="grid-3">{projects.map(item => <StoryCard key={item.slug} item={item} type="projects" />)}</div></div></section>

      <section className="section" style={{ background: "var(--cream-100)" }}><div className="container"><div className="section-head"><div><p className="eyebrow">NEWS & KNOWLEDGE</p><h2 className="heading pre-line">{copy.newsHeading}</h2></div><SectionLink href="/news">ดูทั้งหมด</SectionLink></div><div className="grid-3">{news.map(item => <StoryCard key={item.slug} item={item} type="news" />)}</div></div></section>

      <section className="section"><div className="container"><div className="cta"><div><p className="eyebrow" style={{ color: "var(--lime-400)" }}>LET&apos;S TALK</p><h2 className="heading pre-line">{copy.ctaTitle}</h2>{copy.ctaText && <p style={{ color: "rgba(255,255,255,.7)" }}>{copy.ctaText}</p>}</div><div className="cluster cta-actions">{company.phoneHref && <a className="btn btn-white" href={`tel:${company.phoneHref}`}><Phone size={18} /> โทรหาเรา</a>}<Link className="btn btn-primary" href="/contact"><MapPin size={18} /> ช่องทางติดต่อ</Link></div></div></div></section>
    </>
  );
}

/** ปุ่มหลักใช้ข้อความและลิงก์ที่กรอกในแบนเนอร์ (ตรวจแล้วว่าเป็น / หรือ https:// ตอนบันทึก) ถ้ากรอกไม่ครบใช้ปุ่มดูบริการ */
function HeroButton({ label, href }: Readonly<{ label?: string | null; href?: string | null }>) {
  const text = label?.trim();
  const target = href?.trim();
  if (!text || !target) return <Link className="btn btn-primary" href="/services">ดูบริการของเรา <ArrowRight size={18} /></Link>;
  if (target.startsWith("/")) return <Link className="btn btn-primary" href={target}>{text} <ArrowRight size={18} /></Link>;
  return <a className="btn btn-primary" href={target} rel="noopener">{text} <ArrowRight size={18} /></a>;
}
