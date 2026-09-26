/**
 * หน้าที่ของไฟล์นี้: ข้อความพิมพ์ทีละตัวพร้อมเคอร์เซอร์ ดัดแปลงจาก Text Type ของ React Bits (MIT + Commons Clause)
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: ภาษาไทยพิมพ์ทีละ "กลุ่มตัวอักษร" (พยัญชนะพร้อมสระและวรรณยุกต์) สระจึงไม่ลอยแยก
 * ข้อความเต็มมีอยู่ตลอดสำหรับโปรแกรมอ่านหน้าจอและเครื่องมือค้นหา
 *
 * การตัดบรรทัด: ถ้าแบ่งข้อความเป็นส่วนที่พิมพ์แล้วกับส่วนที่ยังไม่พิมพ์ Safari จะตัดบรรทัดต่างไปตามจุดที่แบ่ง
 * (คำอย่าง "พื้นที่" เด้งขึ้นลงระหว่างพิมพ์) จึงให้เบราว์เซอร์จัดประโยคเต็มแบบข้อความล้วนหนึ่งครั้ง วัดว่าแต่ละบรรทัด
 * มีตัวอักษรใดบ้าง แล้วแสดงทีละบรรทัดแบบห้ามตัดบรรทัดข้างใน บรรทัดจึงตรงกับประโยคเต็มทุกเฟรมในทุกเบราว์เซอร์
 * วัดใหม่เมื่อขนาดเปลี่ยนหรือฟอนต์โหลดเสร็จ เคอร์เซอร์วัดตำแหน่งตัวอักษรตัวล่าสุดแล้ววาดทับ ไม่อยู่ในบรรทัดข้อความ
 *
 * แบบวนซ้ำมีปุ่มหยุด เพราะสิ่งที่ขยับเองนานเกิน 5 วินาทีต้องให้ผู้ใช้หยุดได้ (WCAG 2.2.2)
 */
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";

// แบบพิมพ์รอบเดียว เคอร์เซอร์กะพริบต้องหยุดภายใน 5 วินาที จึงซ่อนหลังพิมพ์จบไม่นาน
const CURSOR_LINGER_MS = 2400;

type TypeTextOptions = { typingSpeed?: number; deletingSpeed?: number; initialDelay?: number; pauseDuration?: number; loop?: boolean };

function graphemes(text: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)].map(part => part.segment);
  }
  return Array.from(text);
}

/** จำนวนกลุ่มตัวอักษรในแต่ละบรรทัด ตามที่เบราว์เซอร์จัดข้อความล้วนใน element ที่ใช้วัด */
function measureLines(measure: HTMLElement, parts: string[]): number[] | null {
  const node = measure.firstChild;
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  const range = document.createRange();
  const counts: number[] = [];
  let offset = 0;
  let lineTop: number | null = null;
  for (const part of parts) {
    range.setStart(node, offset);
    range.setEnd(node, offset + part.length);
    offset += part.length;
    const rect = range.getClientRects()[0];
    // ตัวขึ้นบรรทัดใหม่ในข้อความไม่มีกล่องให้วัด นับรวมกับบรรทัดปัจจุบัน
    if (rect && lineTop !== null && rect.top > lineTop + rect.height / 2) {
      counts.push(0);
      lineTop = rect.top;
    }
    if (rect && lineTop === null) lineTop = rect.top;
    if (counts.length === 0) counts.push(0);
    counts[counts.length - 1] += 1;
  }
  return counts;
}

/** true ระหว่างที่ผู้ใช้ไม่ได้ดูแท็บนี้ ไม่ต้องพิมพ์ต่อเมื่อไม่มีใครเห็น */
function usePageHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return hidden;
}

export function TypeText({ text, paused = false, typingSpeed = 55, deletingSpeed = 30, initialDelay = 350, pauseDuration = 2500, loop = false }: Readonly<{ text: string; paused?: boolean } & TypeTextOptions>) {
  const parts = useMemo(() => graphemes(text), [text]);
  const reduceMotion = useReducedMotion();
  const hidden = usePageHidden();
  const [shown, setShown] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [cursorGone, setCursorGone] = useState(false);
  const [lines, setLines] = useState<number[] | null>(null);
  const still = Boolean(reduceMotion) || paused;
  const finished = !loop && shown >= parts.length;
  const liveRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (still || hidden || finished) return;
    let delay: number;
    let step: () => void;
    if (deleting) {
      delay = shown > 0 ? deletingSpeed : 400;
      step = shown > 0 ? () => setShown(count => count - 1) : () => setDeleting(false);
    } else if (shown < parts.length) {
      delay = shown === 0 ? initialDelay : typingSpeed;
      step = () => setShown(count => count + 1);
    } else {
      delay = pauseDuration;
      step = () => setDeleting(true);
    }
    const timer = setTimeout(step, delay);
    return () => clearTimeout(timer);
  }, [still, hidden, finished, deleting, shown, parts.length, typingSpeed, deletingSpeed, initialDelay, pauseDuration]);

  useEffect(() => {
    if (!finished) return;
    const timer = setTimeout(() => setCursorGone(true), CURSOR_LINGER_MS);
    return () => clearTimeout(timer);
  }, [finished]);

  // จัดบรรทัดจากประโยคเต็ม: วัดครั้งแรกเมื่อเริ่มสังเกตขนาด เมื่อขนาดเปลี่ยน และเมื่อฟอนต์โหลดเสร็จ
  useEffect(() => {
    const live = liveRef.current;
    const measure = measureRef.current;
    if (!live || !measure) return;
    let active = true;
    const update = () => {
      if (!active) return;
      const next = measureLines(measure, parts);
      setLines(current => (current && next && current.join() === next.join() ? current : next));
    };
    const observer = new ResizeObserver(update);
    observer.observe(live);
    void document.fonts?.ready.then(update);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [parts]);

  // หยุดอยู่ไม่ต้องมีเคอร์เซอร์ แบบวนซ้ำแสดงตลอดที่ขยับ แบบรอบเดียวซ่อนหลังพิมพ์จบ
  const cursorVisible = !still && (loop || !cursorGone);
  const visibleCount = still ? parts.length : shown;

  // วางเคอร์เซอร์ต่อท้ายตัวอักษรตัวล่าสุด (หรือหน้าตัวแรกเมื่อยังไม่พิมพ์)
  useLayoutEffect(() => {
    const live = liveRef.current;
    const caret = caretRef.current;
    if (!live || !caret) return;
    const lastTyped = [...live.querySelectorAll(".type-text-typed")].findLast(part => part.textContent);
    const typedRects = lastTyped?.getClientRects();
    const anchor = typedRects?.length ? typedRects[typedRects.length - 1] : live.querySelector(".type-text-rest")?.getClientRects()[0];
    if (!anchor) return;
    const box = live.getBoundingClientRect();
    const x = (typedRects?.length ? anchor.right : anchor.left) - box.left;
    caret.style.transform = `translate(${x}px, ${anchor.top - box.top + anchor.height * 0.78}px)`;
    caret.style.visibility = "visible";
  }, [visibleCount, cursorVisible, lines]);

  // ก่อนวัดบรรทัดได้ (เสี้ยววินาทีแรก ยังไม่เริ่มพิมพ์) ถือทั้งประโยคเป็นบรรทัดเดียวที่ตัดบรรทัดได้ตามปกติ
  const segments = lines ?? [parts.length];
  const rows = segments.map((count, index) => {
    const start = segments.slice(0, index).reduce((sum, previous) => sum + previous, 0);
    return { start, parts: parts.slice(start, start + count) };
  });

  return (
    <span className="type-text">
      <span className="sr-only">{text}</span>
      <span ref={liveRef} className="type-text-live" aria-hidden="true">
        <span ref={measureRef} className="type-text-measure">{text}</span>
        {rows.map(row => {
          const typedCount = Math.min(row.parts.length, Math.max(0, visibleCount - row.start));
          return (
            <span key={row.start} className={lines ? "type-text-line" : undefined}>
              <span className="type-text-typed">{row.parts.slice(0, typedCount).join("")}</span>
              <span className="type-text-rest">{row.parts.slice(typedCount).join("")}</span>
            </span>
          );
        })}
        {cursorVisible && <span ref={caretRef} className="type-text-caret" />}
      </span>
    </span>
  );
}

/** หัวข้อหลักที่พิมพ์วนซ้ำ พร้อมปุ่มหยุด/เล่น (ปุ่มอยู่นอก h1 ชื่อหัวข้อจึงไม่มีคำของปุ่มปน) */
export function TypingHeadline({ text, className }: Readonly<{ text: string; className?: string }>) {
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  return (
    <>
      <h1 className={className}><TypeText text={text} loop paused={paused} /></h1>
      {!reduceMotion && (
        <button type="button" className="type-toggle" aria-pressed={paused} aria-label="หยุดข้อความเคลื่อนไหว" title={paused ? "เล่นข้อความเคลื่อนไหวต่อ" : "หยุดข้อความเคลื่อนไหว"} onClick={() => setPaused(value => !value)}>
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      )}
    </>
  );
}
