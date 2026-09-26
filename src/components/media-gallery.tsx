/**
 * หน้าที่ของไฟล์นี้: แกลเลอรีรูปแบบเลื่อนได้ (สินค้า ผลงาน รูปบริษัท) ลากหรือปัดเปลี่ยนรูป กดลูกศร รูปย่อ หรือปุ่มลูกศรบนคีย์บอร์ด
 *
 * หมายเหตุสำหรับผู้อ่านที่ไม่เขียนโค้ด: การลากแบบสปริงใช้วิธีเดียวกับ Carousel ของ React Bits (ไลบรารี motion)
 * ผู้ที่ตั้งค่าเครื่องให้ลดการเคลื่อนไหวจะเห็นการเปลี่ยนรูปทันทีโดยไม่มีแอนิเมชัน
 */
"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { animate, motion, type PanInfo, useMotionValue, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type MediaRef, ResponsiveMedia } from "./responsive-media";

const SPRING = { type: "spring", stiffness: 300, damping: 34 } as const;
const INSTANT = { duration: 0 } as const;
// ลากเกินหนึ่งในห้าของความกว้าง หรือปัดเร็วพอ จึงนับว่าตั้งใจเปลี่ยนรูป
const SWIPE_DISTANCE = 0.2;
const SWIPE_VELOCITY = 500;

/** เลือกการแสดงผลตามจำนวนรูป: ไม่มีรูปแสดงภาพจำลอง รูปเดียวแสดงรูปนิ่ง หลายรูปเป็นแกลเลอรีเลื่อนได้ */
export function MediaGallery({ images, label, fallbackClass = "silver" }: Readonly<{ images: MediaRef[]; label: string; fallbackClass?: string }>) {
  if (images.length === 0) return <ResponsiveMedia fallbackClass={fallbackClass} className="detail-media" />;
  if (images.length === 1) return <ResponsiveMedia media={images[0]} className="detail-media" priority />;
  return <Carousel images={images} label={label} />;
}

function Carousel({ images, label }: Readonly<{ images: MediaRef[]; label: string }>) {
  const viewportRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const x = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const count = images.length;
  const transition = reduceMotion ? INSTANT : SPRING;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    const controls = animate(x, -index * width, transition);
    return () => controls.stop();
  }, [index, width, x, transition]);

  const show = (next: number) => setIndex((next + count) % count);

  function onDragEnd(_: unknown, info: PanInfo) {
    const pastDistance = Math.abs(info.offset.x) > width * SWIPE_DISTANCE;
    const pastVelocity = Math.abs(info.velocity.x) > SWIPE_VELOCITY;
    const direction = info.offset.x < 0 ? 1 : -1;
    const next = Math.min(count - 1, Math.max(0, index + direction));
    if ((pastDistance || pastVelocity) && next !== index) setIndex(next);
    // ลากไม่ถึงเกณฑ์หรือสุดขอบแล้ว ให้สปริงกลับรูปเดิม
    else animate(x, -index * width, transition);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: count - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    show(target);
  }

  return (
    <div className="product-gallery">
      <section ref={viewportRef} className="gallery-viewport" aria-roledescription="carousel" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>
        <motion.div className="gallery-track" style={{ x }} drag="x" dragConstraints={{ left: -(count - 1) * width, right: 0 }} dragElastic={0.18} dragMomentum={false} onDragEnd={onDragEnd}>
          {images.map((media, slide) => (
            <div key={media.id} className="gallery-slide" role="group" aria-roledescription="slide" aria-label={`รูปที่ ${slide + 1} จาก ${count}`} aria-hidden={slide !== index}>
              <ResponsiveMedia media={media} priority={slide === 0} />
            </div>
          ))}
        </motion.div>
        <button type="button" className="gallery-arrow prev" aria-label="รูปก่อนหน้า" onClick={() => show(index - 1)}><ChevronLeft size={22} /></button>
        <button type="button" className="gallery-arrow next" aria-label="รูปถัดไป" onClick={() => show(index + 1)}><ChevronRight size={22} /></button>
        <output className="gallery-counter" aria-live="polite">{index + 1} / {count}</output>
      </section>
      <div className="gallery-thumbs">
        {images.map((media, slide) => (
          <button key={media.id} type="button" className="gallery-thumb" aria-label={`ดูรูปที่ ${slide + 1}`} aria-current={slide === index ? "true" : undefined} onClick={() => setIndex(slide)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- /api/media already serves resized WebP; the Next image optimizer is not used */}
            <img src={`/api/media/${media.id}?format=webp&width=320`} alt="" width={96} height={72} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  );
}
