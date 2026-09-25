/**
 * หน้าที่ของไฟล์นี้: เมนู "ในหน้านี้" ที่ไฮไลต์หัวข้อซึ่งผู้ใช้เลื่อนมาถึง และพาไปยังหัวข้อเมื่อกด
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: หัวข้อที่ไฮไลต์คือหัวข้อสุดท้ายที่เลื่อนผ่านขอบบนของจอ
 */
"use client";
import { useEffect, useRef, useState } from "react";

type SectionLink = { id: string; title: string };

/** ระยะจากขอบบนของจอที่ถือว่า "เลื่อนถึงหัวข้อแล้ว" (เผื่อระยะ scroll-margin ของการ์ด) */
const ACTIVATION_OFFSET = 140;

/** เลือกหัวข้อที่กำลังอ่าน: หัวข้อสุดท้ายที่ขอบบนผ่านเส้นอ้างอิงแล้ว หรือหัวข้อสุดท้ายเมื่อเลื่อนถึงท้ายหน้า */
export function activeSectionId(tops: { id: string; top: number }[], atBottom: boolean, offset = ACTIVATION_OFFSET) {
  if (!tops.length) return null;
  if (atBottom) return tops[tops.length - 1].id;
  let active = tops[0].id;
  for (const section of tops) if (section.top <= offset) active = section.id;
  return active;
}

/** สร้างส่วนหน้าจอ SectionNav; รับรายการหัวข้อแล้วคืนเมนูลิงก์ที่ไฮไลต์ตามตำแหน่งที่เลื่อน */
export function SectionNav({ links, label, title = "ในหน้านี้" }: { links: SectionLink[]; label: string; title?: string }) {
  const [active, setActive] = useState(links[0]?.id ?? null);
  // ระหว่างเลื่อนแบบนุ่มนวลหลังกดลิงก์ ไม่ให้ไฮไลต์วิ่งผ่านหัวข้อระหว่างทาง
  const lockUntil = useRef(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      if (Date.now() < lockUntil.current) return;
      const tops = links.flatMap(link => {
        const element = document.getElementById(link.id);
        return element ? [{ id: link.id, top: element.getBoundingClientRect().top }] : [];
      });
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const next = activeSectionId(tops, atBottom);
      if (next) setActive(next);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const release = () => { lockUntil.current = 0; schedule(); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("scrollend", release);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scrollend", release);
    };
  }, [links]);

  return (
    <nav className="form-section section-nav" aria-label={label}>
      <h2>{title}</h2>
      <ul>
        {links.map(link => (
          <li key={link.id}>
            <a
              href={`#${link.id}`}
              className={active === link.id ? "active" : undefined}
              aria-current={active === link.id ? "location" : undefined}
              onClick={() => { setActive(link.id); lockUntil.current = Date.now() + 1200; }}
            >
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
