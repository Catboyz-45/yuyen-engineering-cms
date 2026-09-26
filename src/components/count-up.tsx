/**
 * หน้าที่ของไฟล์นี้: ตัวเลขนับขึ้นเมื่อปรากฏบนจอ ดัดแปลงแนวคิดจาก Count Up ของ React Bits
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ตัวเลขที่มองเห็นเริ่มจาก 0 แล้วนับขึ้นครั้งเดียวเมื่อเห็นบนจออย่างน้อยครึ่งหนึ่ง
 * (อยู่บนจอตั้งแต่เปิดหน้าก็นับทันที อยู่ต่ำกว่าจอก็นับตอนเลื่อนมาถึง)
 * โปรแกรมอ่านหน้าจอและเครื่องมือค้นหาได้ตัวเลขจริงจากข้อความที่ซ่อนไว้เสมอ ไม่ได้ตัวเลขระหว่างนับ
 * ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหวเห็นตัวเลขจริงทันที ส่วนเบราว์เซอร์ที่ปิด JavaScript ใช้ CountUpFallback แสดงตัวเลขจริงแทน
 */
"use client";

import { useEffect, useRef } from "react";
import { formatStat } from "@/lib/site-copy";

const DURATION_MS = 1800;

export function CountUp({ value, suffix }: Readonly<{ value: number; suffix: string }>) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const show = (current: number) => { element.textContent = formatStat(current, suffix); };
    if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      show(value);
      return;
    }
    let frame = 0;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / DURATION_MS);
        show(Math.round(value * (1 - (1 - progress) ** 3)));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      show(value);
    };
  }, [value, suffix]);

  return (
    <span className="count-up">
      <span className="sr-only">{formatStat(value, suffix)}</span>
      <span ref={ref} className="count-up-live" aria-hidden="true">{formatStat(0, suffix)}</span>
    </span>
  );
}

/** ใส่ครั้งเดียวต่อหน้า: ปิด JavaScript แล้วซ่อนตัวเลข 0 และแสดงตัวเลขจริง (ข้อความเดียวกับที่โปรแกรมอ่านหน้าจอได้) */
export function CountUpFallback() {
  return (
    <noscript>
      <style>{".count-up-live{display:none}.count-up .sr-only{position:static;width:auto;height:auto;margin:0;overflow:visible;clip:auto;clip-path:none;white-space:normal}"}</style>
    </noscript>
  );
}
