/**
 * หน้าที่ของไฟล์นี้: คอมโพเนนต์ React site-shell ซึ่งรวมหน้าตาและพฤติกรรมที่นำกลับมาใช้ซ้ำในหน้าเว็บ
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: อ่านคำอธิบายนี้ก่อน แล้วไล่ดูชื่อฟังก์ชันและคอมเมนต์ใกล้กฎสำคัญด้านล่าง
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronRight, Menu, Phone, X } from "lucide-react";
import { Logo } from "./logo";
import { resolvePublicCompany, type PublicCompany } from "@/lib/company-display";
import { legalLinks } from "@/lib/legal";

type FooterService = { title: string; slug: string };

const links = [
  ["/", "หน้าแรก"], ["/about", "เกี่ยวกับเรา"], ["/services", "บริการ"],
  ["/products", "สินค้า"], ["/projects", "ผลงาน"], ["/news", "ข่าวสาร"], ["/contact", "ติดต่อเรา"],
] as const;

/** สร้างส่วนหน้าจอ SiteHeader; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SiteHeader({ logo }: { logo?: PublicCompany["logo"] }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setIsOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", closeOnEscape); trigger?.focus(); };
  }, [isOpen]);
  return (
    <><header className="site-header">
      <nav className="container nav" aria-label="เมนูหลัก">
        <Link href="/" aria-label="อยู่เย็นเป็นสุข วิศวกรรม หน้าแรก"><Logo media={logo} /></Link>
        <div className="nav-links">
          {links.map(([href, label]) => <Link key={href} href={href} style={{ color: pathname === href ? "var(--green-700)" : undefined }}>{label}</Link>)}
        </div>
        <Link className="btn btn-primary" href="/contact"><Phone size={16} /> ติดต่อเรา</Link>
        <button ref={triggerRef} className="btn btn-outline mobile-nav" type="button" aria-expanded={isOpen} aria-controls="mobile-menu" onClick={() => setIsOpen(true)} aria-label="เปิดเมนู"><Menu size={20} /></button>
      </nav>
    </header>{isOpen && <><button className="drawer-backdrop" aria-label="ปิดเมนู" onClick={() => setIsOpen(false)} /><aside ref={drawerRef} className="drawer" id="mobile-menu" role="dialog" aria-modal="true" aria-label="เมนูหลักบนมือถือ"><div className="drawer-header"><Logo /><button ref={closeButtonRef} className="icon-btn" onClick={() => setIsOpen(false)} aria-label="ปิดเมนู"><X size={22} /></button></div><nav className="drawer-nav">{links.map(([href, label]) => <Link onClick={() => setIsOpen(false)} aria-current={pathname === href ? "page" : undefined} className={`drawer-link ${pathname === href ? "active" : ""}`} key={href} href={href}>{label}<ChevronRight size={17} /></Link>)}</nav><div className="drawer-footer"><Link onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ width: "100%" }} href="/contact"><Phone size={17} /> ติดต่อเรา</Link></div></aside></>}</>
  );
}

/** สร้างส่วนหน้าจอ SiteFooter; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SiteFooter({ company, services = [] }: { company: PublicCompany; services?: FooterService[] }) {
  const lineText = company.lineLabel ? `LINE ${company.lineLabel}` : "LINE";
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="stack"><Logo inverse media={company.logo} /><p style={{ maxWidth: 340 }}>ดูแลทุกเรื่องระบบปรับอากาศและงานวิศวกรรม ด้วยบริการที่ตรงไปตรงมาและใส่ใจในระยะยาว</p></div>
          <div><h3>บริษัท</h3><div className="footer-links"><Link href="/about">เกี่ยวกับเรา</Link><Link href="/projects">ผลงานของเรา</Link><Link href="/news">ข่าวสาร</Link></div></div>
          <div><h3>บริการ</h3><div className="footer-links">{services.slice(0, 3).map(service => <Link key={service.slug} href={`/services/${service.slug}`}>{service.title}</Link>)}<Link href="/services">บริการทั้งหมด</Link></div></div>
          <div><h3>ติดต่อ</h3><div className="footer-links">{company.phoneHref && company.phoneDisplay && <a href={`tel:${company.phoneHref}`}>โทร {company.phoneDisplay}</a>}{company.lineUrl ? <a href={company.lineUrl} target="_blank" rel="noreferrer">{lineText}</a> : company.isPlaceholder ? <span>{lineText} (รอยืนยัน)</span> : company.lineLabel && <span>{lineText}</span>}{company.businessHours && <span>{company.businessHours}</span>}<Link href="/contact">ช่องทางติดต่อทั้งหมด</Link></div></div>
        </div>
        <nav className="legal-links" aria-label="นโยบายและเงื่อนไข">{legalLinks.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}</nav>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} {company.name}</span>{company.isPlaceholder && <span>ข้อมูลตัวอย่างสำหรับการพัฒนาระบบ</span>}</div>
      </div>
    </footer>
  );
}

/** สร้างส่วนหน้าจอ PublicShell; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function PublicShell({ children, company = resolvePublicCompany(null), services }: { children: React.ReactNode; company?: PublicCompany; services?: FooterService[] }) {
  const pathname = usePathname();
  return <><a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a><span className="sr-only" role="status" aria-live="polite">เปิดหน้า {pathname}</span><SiteHeader logo={company.logo} /><main id="main-content" tabIndex={-1}>{children}</main><SiteFooter company={company} services={services} /></>;
}

/** สร้างส่วนหน้าจอ SectionLink; รับข้อมูลผ่านพารามิเตอร์แล้วคืน React elements สำหรับแสดงผล */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="btn btn-outline" href={href}>{children}<ArrowRight size={17} /></Link>;
}
