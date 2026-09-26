/** หน้าที่ของไฟล์นี้: จัดหน้านโยบายภาษาไทย มีสารบัญ สถานะเอกสาร และช่องทางใช้สิทธิ์ */
import Link from "next/link";
import type { ReactNode } from "react";
import { legalRevision } from "@/lib/legal";
import type { PublicLegalNotice } from "@/server/services/legal-notice.service";

type Section = { id: string; title: string; content: ReactNode };

const thaiDate = new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" });

/** แสดงหัวข้ออย่างเป็นลำดับ อ่านด้วยคีย์บอร์ดและโปรแกรมอ่านหน้าจอได้ */
export function LegalDocument({ title, summary, sections, notice }: Readonly<{ title: string; summary: string; sections: Section[]; notice: PublicLegalNotice }>) {
  return (
    <article className="container legal-document">
      <header className="stack">
        <p className="eyebrow">ข้อมูลการใช้เว็บไซต์</p>
        <h1 className="heading">{title}</h1>
        <p className="lead">{summary}</p>
        <p className="muted">
          ปรับปรุงล่าสุด {legalRevision}
          {notice.approved && notice.approvedAt && <> · ประกาศใช้ {thaiDate.format(new Date(notice.approvedAt))}</>}
        </p>
        {!notice.approved && (
          <aside className="legal-review" aria-label="สถานะเอกสาร">
            ฉบับร่างเพื่อการตรวจทาน — บริษัทอยู่ระหว่างยืนยันช่องทางติดต่อ ระยะเวลาเก็บข้อมูล
            และรายละเอียดผู้ให้บริการก่อนประกาศใช้จริง
          </aside>
        )}
      </header>
      <nav className="card card-body legal-toc" aria-label="สารบัญนโยบาย">
        <h2 className="subheading">ในหน้านี้</h2>
        <ul>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul>
      </nav>
      {sections.map(section => (
        <section className="legal-section" key={section.id} aria-labelledby={section.id}>
          <h2 className="subheading" id={section.id}>{section.title}</h2>
          {section.content}
        </section>
      ))}
      <p><Link href="/contact">ดูช่องทางติดต่อบริษัท</Link></p>
    </article>
  );
}

/** ใช้อีเมลที่ Super Admin ตั้งในหลังบ้านเท่านั้น ไม่หยิบอีเมลตัวอย่างหรืออีเมลทั่วไปของบริษัทมาใช้รับคำร้อง */
export function PrivacyContact({ email }: { email: string | null }) {
  return email ? (
    <p>ติดต่อบริษัท อยู่เย็นเป็นสุข วิศวกรรม จำกัด เรื่องข้อมูลส่วนบุคคลได้ที่ <a href={`mailto:${email}`}>{email}</a> กรุณาระบุเรื่องที่ต้องการให้ช่วยและช่องทางตอบกลับ บริษัทอาจขอข้อมูลเท่าที่จำเป็นเพื่อยืนยันว่าเป็นเจ้าของข้อมูลก่อนดำเนินการ</p>
  ) : (
    <p>ช่องทางรับคำร้องเกี่ยวกับข้อมูลส่วนบุคคลอยู่ระหว่างการยืนยันจากบริษัท และจะระบุที่นี่ก่อนประกาศใช้เอกสารฉบับจริง</p>
  );
}
