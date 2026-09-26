/**
 * หน้าที่ของไฟล์นี้: ให้หัวข้อและการ์ดค่อยๆ ปรากฏเมื่อเลื่อนลงมาถึง ดัดแปลงแนวคิดจาก Animated Content ของ React Bits
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: เนื้อหาทั้งหมดอยู่ในหน้าเว็บตั้งแต่แรก (เครื่องมือค้นหาเห็นครบ) และไม่ถูกซ่อนถ้าสคริปต์ไม่ทำงาน
 * ระบบซ่อนเฉพาะสิ่งที่ยังอยู่ต่ำกว่าจอ แล้วให้ปรากฏครั้งเดียวเมื่อเลื่อนมาถึง สิ่งที่เห็นอยู่แล้วตอนเปิดหน้าไม่ขยับ
 * ผู้ใช้ที่ตั้งค่าลดการเคลื่อนไหวจะเห็นทุกอย่างทันที และสั่งพิมพ์หน้าเว็บได้ครบโดยไม่ต้องเลื่อนก่อน
 *
 * ใช้ Web Animations API แทนการเพิ่มคลาส จึงไม่แก้ attribute ของ element ที่ React ดูแลอยู่
 * (แก้คลาสระหว่างที่ React กำลัง hydrate ทำให้ข้อมูลหน้าเว็บกับฝั่งเบราว์เซอร์ไม่ตรงกัน)
 */
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TARGETS = ".section-head, .grid-2 > *, .grid-3 > *, .grid-4 > *, .process-item, .brand-strip, .cta";
// การ์ดในแถวเดียวกันปรากฏไล่กัน ห่างกันเท่านี้
const STAGGER_MS = 90;
const KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(18px)" },
  { opacity: 1, transform: "none" },
];

export function RevealOnScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const main = document.getElementById("main-content") ?? document.body;
    const pending = new Map<Element, Animation>();
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        pending.get(entry.target)?.play();
        pending.delete(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    const register = (element: Element) => {
      if (seen.has(element)) return;
      seen.add(element);
      if (element.getBoundingClientRect().top <= window.innerHeight) return;
      const index = element.parentElement ? [...element.parentElement.children].indexOf(element) : 0;
      // หยุดไว้ที่เฟรมแรก (มองไม่เห็น) จนกว่าจะเลื่อนมาถึง เมื่อเล่นจบ เอฟเฟกต์หายไปเอง การ์ดกลับไปใช้ hover ปกติ
      const animation = element.animate(KEYFRAMES, { duration: 600, delay: (index % 4) * STAGGER_MS, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" });
      animation.pause();
      pending.set(element, animation);
      observer.observe(element);
    };
    const scan = (root: Element) => {
      if (root.matches(TARGETS)) register(root);
      root.querySelectorAll(TARGETS).forEach(register);
    };
    scan(main);
    // เนื้อหาบางส่วนส่งตามมาทีหลัง (streaming) จึงตรวจของที่เพิ่มเข้ามาด้วย
    const mutations = new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(node => { if (node instanceof Element) scan(node); });
    });
    mutations.observe(main, { childList: true, subtree: true });
    const showAll = () => {
      mutations.disconnect();
      observer.disconnect();
      for (const animation of pending.values()) animation.cancel();
      pending.clear();
    };
    window.addEventListener("beforeprint", showAll);
    return () => {
      window.removeEventListener("beforeprint", showAll);
      showAll();
    };
  }, [pathname]);

  return null;
}
